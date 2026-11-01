import { z } from "zod";

export const createSchema = z.object({
  displayName: z.string().trim().min(1, "Tell us your name").max(60),
  householdName: z.string().trim().min(1, "Name your household").max(80),
});

export const joinSchema = z.object({
  displayName: z.string().trim().min(1, "Tell us your name").max(60),
  code: z.string().trim().regex(/^[A-Za-z0-9]{8}$/, "Invite codes are 8 letters/numbers"),
});

/** Friendly message for accept_invite errors. */
export function inviteErrorMessage(message: string) {
  if (message.includes("expired")) return "That invite has expired. Ask for a new one.";
  if (message.includes("used")) return "That invite was already used by someone else. Ask for a new one.";
  if (message.includes("not found")) return "Invite code not found. Check the code, or ask for a new invite.";
  return "Couldn't join right now. Try again in a moment.";
}
