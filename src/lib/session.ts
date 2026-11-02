import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MODULE_BY_KEY } from "@/modules/registry";
import type {
  Household,
  HouseholdMember,
  HouseholdModule,
  ModuleShare,
  Profile,
  ShareLevel,
} from "@/lib/types";

export const VIEW_COOKIE = "ls_view";
export type ViewMode = "me" | "partner";
export type Access = "none" | ShareLevel;

export type AppSession = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  email: string | null;
  profile: Profile;
  household: Household;
  members: HouseholdMember[];
  me: HouseholdMember;
  partner: HouseholdMember | null;
  modules: HouseholdModule[];
  shares: ModuleShare[];
  viewMode: ViewMode;
  /** Whose personal data the screens show: me, or my partner in partner view. */
  subject: HouseholdMember;
  isModuleEnabled: (key: string) => boolean;
  /** The person switched this feature off for themselves (Settings → My features). */
  isHiddenFor: (key: string, userId: string) => boolean;
  /** On for the household and not switched off by the person being viewed: use for navigation and hubs. */
  isShown: (key: string) => boolean;
  /** What I can do with `ownerId`'s personal data in a module. */
  accessTo: (moduleKey: string, ownerId: string) => Access;
};

/** Signed-in user + profile, without requiring a household. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return {
    supabase,
    userId,
    email: (data?.claims?.email as string | undefined) ?? null,
    profile: profile as Profile | null,
  };
});

/** Full app context. Redirects to onboarding when the user has no household yet. */
export const getSession = cache(async (): Promise<AppSession> => {
  const { supabase, userId, email, profile } = await getUser();
  if (!profile?.active_household_id) redirect("/onboarding");
  const cookieStore = await cookies();
  const session = await buildSession(supabase, userId, email, profile, cookieStore.get(VIEW_COOKIE)?.value === "partner" ? "partner" : "me");
  if (!session) redirect("/onboarding");
  return session;
});

/**
 * Builds the context for a user from any Supabase client. Background jobs pass
 * the service-role client (always in "me" view) so AI context and reminders
 * use exactly the same rules as the app.
 */
export async function buildSession(
  supabase: AppSession["supabase"],
  userId: string,
  email: string | null,
  profile: Profile,
  view: ViewMode,
): Promise<AppSession | null> {
  const householdId = profile.active_household_id;
  if (!householdId) return null;
  const [householdRes, membersRes, modulesRes, sharesRes] = await Promise.all([
    supabase.from("households").select("*").eq("id", householdId).single(),
    supabase.from("household_members").select("user_id, role, joined_at").eq("household_id", householdId).order("joined_at"),
    supabase.from("household_modules").select("module_key, enabled, settings").eq("household_id", householdId),
    supabase.from("module_shares").select("owner_id, grantee_id, module_key, level").or(`owner_id.eq.${userId},grantee_id.eq.${userId}`),
  ]);
  if (!householdRes.data) return null;

  const rawMembers = (membersRes.data ?? []) as Omit<HouseholdMember, "display_name">[];
  if (!rawMembers.some((m) => m.user_id === userId)) return null;
  const ids = rawMembers.map((m) => m.user_id);
  // hidden_modules is newer: fall back to names only on a database that hasn't been updated.
  type NameRow = { id: string; display_name: string; hidden_modules?: string[] | null };
  const first = await supabase.from("profiles").select("id, display_name, hidden_modules").in("id", ids);
  const names: NameRow[] | null = first.error ? ((await supabase.from("profiles").select("id, display_name").in("id", ids)).data as NameRow[] | null) : (first.data as NameRow[] | null);
  const nameById = new Map((names ?? []).map((n) => [n.id, n.display_name]));
  const hiddenById = new Map((names ?? []).map((n) => [n.id, new Set(n.hidden_modules ?? [])]));
  const members: HouseholdMember[] = rawMembers.map((m) => ({
    ...m,
    display_name: nameById.get(m.user_id) || "Member",
  }));

  const me = members.find((m) => m.user_id === userId)!;
  const partner = members.find((m) => m.user_id !== userId) ?? null;
  const modules = (modulesRes.data ?? []) as HouseholdModule[];
  const shares = (sharesRes.data ?? []) as ModuleShare[];
  const memberIds = new Set(members.map((m) => m.user_id));

  const viewMode: ViewMode = view === "partner" && partner ? "partner" : "me";
  const subject = viewMode === "partner" && partner ? partner : me;
  const enabled = new Set(modules.filter((m) => m.enabled).map((m) => m.module_key));

  return {
    supabase,
    userId,
    email,
    profile,
    household: householdRes.data as Household,
    members,
    me,
    partner,
    modules,
    shares,
    viewMode,
    subject,
    isModuleEnabled: (key) => enabled.has(key) && MODULE_BY_KEY[key]?.status === "available",
    isHiddenFor: (key, uid) => hiddenById.get(uid)?.has(key) ?? false,
    isShown: (key) => enabled.has(key) && MODULE_BY_KEY[key]?.status === "available" && !(hiddenById.get(subject.user_id)?.has(key) ?? false),
    accessTo: (moduleKey, ownerId) => {
      if (ownerId === userId) return "write";
      if (!memberIds.has(ownerId)) return "none";
      const share = shares.find(
        (s) => s.owner_id === ownerId && s.grantee_id === userId && s.module_key === moduleKey,
      );
      return share?.level ?? "none";
    },
  };
}

/**
 * Records that the current user looked at someone else's shared data, at most
 * once every 30 minutes per owner/module, so the owner can see an audit trail.
 */
export async function logPartnerView(session: AppSession, moduleKey: string) {
  if (session.subject.user_id === session.userId) return;
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { count } = await session.supabase
    .from("share_access_log")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", session.subject.user_id)
    .eq("viewer_id", session.userId)
    .eq("module_key", moduleKey)
    .gte("viewed_at", since);
  if (!count) {
    await session.supabase.from("share_access_log").insert({
      owner_id: session.subject.user_id,
      viewer_id: session.userId,
      module_key: moduleKey,
    });
  }
}
