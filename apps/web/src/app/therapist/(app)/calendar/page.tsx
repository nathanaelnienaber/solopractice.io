import { Suspense } from "react";
import { AppointmentCalendarPage } from "@/components/therapist/appointment-calendar-page";
import { PageShell } from "@/components/ui/page";

export default function TherapistCalendarPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <p className="text-muted-foreground">Loading...</p>
        </PageShell>
      }
    >
      <AppointmentCalendarPage />
    </Suspense>
  );
}
