import { describe, expect, it } from "vitest";
import { leakKey, parseWhatsAppLeaks } from "@/modules/bladder/whatsapp";

const opts = { today: "2026-11-02", tz: "Asia/Kolkata", ownerName: "Asha" };
const one = (line: string) => parseWhatsAppLeaks(line, opts);

describe("WhatsApp leak import", () => {
  it("reads iOS and Android lines and the year", () => {
    const a = one("[05/10, 18:04] Asha❤️: Leak");
    expect(a.rows[0]).toMatchObject({ date: "2026-10-05", time: "18:04", amount: "small", sender: "Asha" });
    expect(a.rows[0].at).toBe("2026-10-05T12:34:00.000Z"); // IST
    const b = one("05/10/26, 6:04 pm - Asha: Leak");
    expect(b.rows[0]).toMatchObject({ date: "2026-10-05", time: "18:04" });
    // A day after "today" without a year belongs to last year.
    expect(one("[25/12, 10:00] Asha: Leak").rows[0].date).toBe("2025-12-25");
  });

  it("maps amounts and typos", () => {
    expect(one("[05/10, 10:00] Asha: Less leak").rows[0].amount).toBe("drops");
    expect(one("[05/10, 10:00] Asha: Les leak").rows[0].amount).toBe("drops");
    expect(one("[05/10, 10:00] Asha: Lil leak").rows[0].amount).toBe("drops");
    expect(one("[05/10, 10:00] Asha: Alot of leak").rows[0].amount).toBe("large");
    expect(one("[05/10, 10:00] Asha: Continuous leak").rows[0].amount).toBe("large");
    expect(one("[05/10, 10:00] Asha: Kesk").rows).toHaveLength(1);
    expect(one("[05/10, 10:00] Asha: Less lesk").rows[0].amount).toBe("drops");
    expect(one("[05/10, 10:00] Asha: feeling weak").rows).toHaveLength(0);
  });

  it("uses times written in the text", () => {
    expect(one("[05/10, 18:17] Asha: Leak at 5").rows[0].time).toBe("17:00");
    expect(one("[05/10, 18:17] Asha: Leak at 6:10").rows[0].time).toBe("18:10");
    expect(one("[05/10, 10:05] Asha: Leak at 7 am").rows[0].time).toBe("07:00");
    expect(one("[05/10, 23:39] Asha: 11:15 leak in washroom").rows[0].time).toBe("23:15");
    expect(one("[05/10, 07:49] Asha: Leak 5:30").rows[0].time).toBe("05:30");
    expect(one("[05/10, 18:04] Asha: 5:55 while urinating 3 drops").rows[0]).toMatchObject({ time: "17:55", amount: "drops", triggers: ["other"] });
    const unclear = one("[05/10, 07:05] Asha: Leak 3:2").rows[0];
    expect(unclear.time).toBe("07:05");
    expect(unclear.notes).toContain("time unclear");
  });

  it("counts, night leaks and spreads 'from morning'", () => {
    expect(one("[05/10, 17:32] Asha: Leak 2 times").rows.map((r) => r.time)).toEqual(["17:32", "17:33"]);
    const night = one("[05/10, 06:27] Asha: 3 leak at night").rows;
    expect(night.map((r) => r.time)).toEqual(["02:00", "02:01", "02:02"]);
    expect(night[0].triggers).toContain("during_sleep");
    expect(one("[05/10, 07:08] Asha: Leak in night 2 times").rows).toHaveLength(2);
    const morning = one("[05/10, 10:46] Asha: 4 times leak from morning").rows;
    expect(morning).toHaveLength(4);
    expect(morning[0].time).toBe("07:00");
    expect(morning[3].time < "10:46").toBe(true);
    expect(one("[05/10, 23:02] Asha: Many times leak").rows[0].notes).toContain("several times");
  });

  it("tags triggers", () => {
    expect(one("[05/10, 10:00] Asha: Leak in cough").rows[0].triggers).toEqual(["cough"]);
    expect(one("[05/10, 10:00] Asha: Leak in sneezing 🤧").rows[0].triggers).toEqual(["sneeze"]);
    expect(one("[05/10, 10:00] Asha: Leak while laughing").rows[0].triggers).toEqual(["laugh"]);
    expect(one("[05/10, 10:00] Asha: Leak 2 times in yoga").rows[0].triggers).toEqual(["yoga"]);
    expect(one("[05/10, 10:00] Asha: Leak in washroom").rows[0].triggers).toEqual(["urgency"]);
    expect(one("[05/10, 10:00] Asha: Leak while passing gas").rows[0].triggers).toEqual(["other"]);
  });

  it("skips non-leaks with a reason and keeps discharge as a note", () => {
    const r = parseWhatsAppLeaks(["[05/10, 19:22] Asha: No leak its discharge", "[05/10, 19:46] Asha: Less discharge", "[05/10, 13:36] Asha: Vomit after breakfast", "[05/10, 11:11] Asha: Less leak with discharge"].join("\n"), opts);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].notes).toContain("with discharge");
    expect(r.skipped.map((s) => s.reason)).toEqual(["Discharge, not a leak", "Discharge, not a leak", "Health note: add it as an event"]);
  });

  it("handles continuation lines and who logged it", () => {
    const r = parseWhatsAppLeaks("[05/10, 02:38] Asha: Leak 2:01\nLeak 2:18\n[05/10, 13:13] Ravi: less leak", opts);
    expect(r.rows.map((x) => x.time)).toEqual(["02:01", "02:18", "13:13"]);
    expect(r.rows[2].notes).toContain("logged by Ravi");
    expect(r.rows[0].notes).not.toContain("logged by");
  });

  it("does not read clock times as counts, and keeps same-minute repeats", () => {
    expect(one("[05/10, 23:39] Asha: 11:15 leak in washroom").rows.map((x) => x.time)).toEqual(["23:15"]);
    expect(one("[05/10, 07:10] Asha: 6:30 leak").rows).toHaveLength(1);
    expect(one("[05/10, 07:10] Asha: Leak and leak in washroom").rows).toHaveLength(2);
    const r = parseWhatsAppLeaks("[05/10, 18:19] Asha: Leak\n[05/10, 18:19] Asha: Leak", opts);
    expect(r.rows.map((x) => x.time)).toEqual(["18:19", "18:20"]);
    expect(new Set(r.rows.map(leakKey)).size).toBe(2);
  });

  it("gives a stable key for duplicate checks", () => {
    const [row] = one("[05/10, 10:00] Asha: Leak").rows;
    expect(leakKey({ at: row.at, notes: row.notes })).toBe(leakKey({ at: "2026-10-05T04:30:00+00:00", notes: row.notes }));
  });
});
