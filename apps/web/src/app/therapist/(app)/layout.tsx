import { getSessionTherapist } from "@/lib/auth";
import { TherapistNav } from "@/components/therapist/TherapistNav";

export default async function TherapistAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const therapist = await getSessionTherapist();
  const subtitle = therapist
    ? therapist.practiceName ||
      `${therapist.firstName} ${therapist.lastName}, ${therapist.credentials}`
    : undefined;

  return (
    <div className="min-h-screen bg-background">
      <TherapistNav subtitle={subtitle} />
      {children}
    </div>
  );
}
