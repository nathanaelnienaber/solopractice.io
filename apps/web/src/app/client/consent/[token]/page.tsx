import { notFound } from "next/navigation";
import { db, clients, consents, consentFormTemplates } from "@/db";
import { eq, and } from "drizzle-orm";
import { ConsentForm } from "./consent-form";
import { REQUIRED_CONSENT_TEMPLATES, getTemplateHash } from "@/lib/consent-templates";

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
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Link Expired</h1>
          <p className="text-muted-foreground">
            This consent link has expired. Please contact your therapist for a new link.
          </p>
        </div>
      </main>
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
        <div className="max-w-3xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">Intake Forms</h1>
          <p className="text-muted-foreground">
            {client.therapist.practiceName ||
              `${client.therapist.firstName} ${client.therapist.lastName}, ${client.therapist.credentials}`}
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {allSigned ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-success"
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
            <h2 className="text-xl font-semibold mb-2">All forms completed!</h2>
            <p className="text-muted-foreground">
              Thank you for completing your intake forms. Your therapist has been notified.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
              <p className="text-sm text-warning font-medium">
                ⚠️ DRAFT FORMS - NOT LEGAL ADVICE
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                These are placeholder forms for testing. Do not use with real clients
                until reviewed by an attorney.
              </p>
            </div>

            <div className="text-sm text-muted-foreground">
              <p>
                Hello {client.firstName}, please review and sign the following{" "}
                {pendingForms.length} form{pendingForms.length > 1 ? "s" : ""} to complete
                your intake.
              </p>
            </div>

            <ConsentForm
              clientId={client.id}
              token={token}
              forms={pendingForms}
            />
          </div>
        )}
      </div>
    </main>
  );
}
