import {
  Activity, Baby, Flower2, BedDouble, CalendarCheck, ChefHat, ClipboardList, Droplet, Dumbbell, FileBadge, Gift, HeartPulse, House,
  ListChecks, LockKeyhole, Pill, Plane, Refrigerator, Repeat, Salad, Scale, Settings, ShoppingCart, Smile, Sparkles, Stethoscope, Tv,
  UserRound, Utensils, UtensilsCrossed, Watch, Waves, Wrench, type LucideIcon,
} from "lucide-react";

/** One consistent line-icon per feature (replaces emoji in navigation and hubs). */
export const MODULE_ICONS: Record<string, LucideIcon> = {
  medical_records: Stethoscope,
  medicines: Pill,
  supplements: ClipboardList,
  bladder_diary: Droplet,
  pelvic_floor: Waves,
  cycle: Flower2,
  private_log: LockKeyhole,
  checkin: Smile,
  habits: ListChecks,
  groceries: ShoppingCart,
  food_diary: Utensils,
  body_recomp: Scale,
  pantry: Refrigerator,
  recipes: ChefHat,
  fitness: Dumbbell,
  child: Baby,
  maintenance: Wrench,
  documents: FileBadge,
  subscriptions: Repeat,
  wearables: Watch,
  watchlist: Tv,
  dining: UtensilsCrossed,
  travel: Plane,
  occasions: Gift,
};

export const NAV_ICONS = { today: House, health: HeartPulse, food: Salad, me: UserRound, ai: Sparkles, settings: Settings, activity: Activity, sleep: BedDouble, calendar: CalendarCheck } as const;

export function ModuleIcon({ moduleKey, className = "size-5" }: { moduleKey: string; className?: string }) {
  const I = MODULE_ICONS[moduleKey] ?? Activity;
  return <I className={className} strokeWidth={1.75} aria-hidden />;
}
