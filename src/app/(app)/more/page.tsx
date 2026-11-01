import { redirect } from "next/navigation";

/** Old "More" page: everything now lives in the Health and Me hubs. */
export default function MorePage() {
  redirect("/me");
}
