import { notFound } from "next/navigation";
import { db, clients } from "@/db";
import { eq } from "drizzle-orm";
import { ConsentForm } from "./consent-form";
import { REQUIRED_CONSENT_TEMPLATES, getTemplateHash } from "@/lib/consent-templates";
import { CenteredShell, PageShell } from "@/components/ui/page";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function ConsentPage({ params }: PageProps) {
  const { token } = await params;

  const client = await db.query.clients.findFirst({
    where: eq(clients.magicLinkToken, token),
    with: {
      therapist: true,
      consents: true,
    },
  });

  if (!client) {
    notFound();
  }

  if (client.magicLinkExpiresAt && new Date() > client.magicLinkExpiresAt) {
    return (
      <CenteredShell>
        <div className="max-w-md text-center">
          <h1 className="mb-4 text-2xl font-bold">Link expired</h1>
          <p className="text-muted-foreground">
            This forms link has expired. Contact your therapist for a new one.
          </p>
        </div>
      </CenteredShell>
    );
  }

  const signedTypes = new Set(
    client.consents.filter((c) => c.status === "signed").map((c) => c.consentType)
  );

  const pendingForms = REQUIRED_CONSENT_TEMPLATES.filter(
    (t) => !signedTypes.has(t.type)
  ).map((template) => ({
    ...template,
    versionHash: getTemplateHash(template),
  }));

  const allSigned = pendingForms.length === 0;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <h1 className="text-2xl font-bold">Intake Forms</h1>
          <p className="text-muted-foreground">
            {client.therapist.practiceName ||
              `${client.therapist.firstName} ${client.therapist.lastName}, ${client.therapist.credentials}`}
          </p>
        </div>
      </header>

      <PageShell className="max-w-3xl">
        {allSigned ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <svg
                className="h-8 w-8 text-success"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="mb-2 text-xl font-semibold">All forms signed</h2>
            <p className="text-muted-foreground">
              Thank you. You can close this page — your therapist has been notified.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="rounded-lg border border-warning/20 bg-warning/10 p-4">
              <p className="text-sm font-medium text-warning">
                DRAFT — NOT LEGAL ADVICE
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                These are sample forms for testing. Do not use with real clients
                until a healthcare attorney reviews them for your practice.
              </p>
            </div>

            <div className="text-sm text-muted-foreground">
              <p>
                Hi {client.firstName} — please review and sign the{" "}
                {pendingForms.length} form{pendingForms.length > 1 ? "s" : ""} below
                to finish intake.
              </p>
            </div>

            <ConsentForm
              clientId={client.id}
              token={token}
              forms={pendingForms}
            />
          </div>
        )}
      </PageShell>
    </main>
  );
}
