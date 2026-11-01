import type { VaultDocument } from "@/lib/types";

export const DOC_LABEL: Record<VaultDocument["doc_type"], string> = {
  passport: "🛂 Passport",
  visa: "🌏 Visa",
  national_id: "🪪 National ID / Aadhaar",
  driving_licence: "🚗 Driving licence",
  pan: "🧾 PAN",
  vehicle_rc: "📄 Vehicle RC",
  vehicle_insurance: "🚙 Vehicle insurance",
  health_insurance: "🏥 Health insurance",
  life_insurance: "🛡️ Life insurance",
  home_insurance: "🏠 Home insurance",
  warranty: "🔧 Warranty",
  lease: "🔑 Lease / rent agreement",
  membership: "🎟️ Membership",
  other: "📁 Other",
};
