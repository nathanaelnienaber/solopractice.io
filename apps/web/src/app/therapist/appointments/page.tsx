import { redirect } from "next/navigation";

/** Legacy route — calendar is the primary scheduling UI. */
export default function AppointmentsRedirectPage() {
  redirect("/therapist/calendar");
}
