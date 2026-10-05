import { Suspense } from "react";
import { AppointmentCalendarPage } from "@/components/therapist/appointment-calendar-page";

export default function TherapistCalendarPage() {
  return (
    <Suspense
      fallback={
        <main className="max-w-6xl mx-auto px-4 py-8">
          <p className="text-muted-foreground">Loading...</p>
        </main>
      }
    >
      <AppointmentCalendarPage />
    </Suspense>
  );
}
