import { redirect } from "next/navigation";
import { getSessionTherapist } from "@/lib/auth";
import {
  retrieveAccountOrNull,
  isStripeConfigured,
  getStripeKeyMode,
} from "@/lib/stripe";
import {
  deriveConnectStatus,
  describeConnectStatus,
  describeOutstandingRequirements,
} from "@/lib/stripe-connect-status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ALL_CONSENT_TEMPLATES } from "@/lib/consent-templates";
import {
  StripeConnectPanel,
  type ConnectStatusPayload,
} from "./stripe-connect-panel";
import { DesktopApiKeyPanel } from "./desktop-api-key-panel";
import { ConsentFormsPanel } from "./consent-forms-panel";
import { LanguagePanel } from "./language-panel";
import { PracticeInfoPanel } from "./practice-info-panel";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const therapist = await getSessionTherapist();

  if (!therapist) {
    redirect("/therapist/login");
  }

  const params = (await searchParams) ?? {};
  // Stripe sends the therapist back here via return_url/refresh_url.
  const justReturned =
    params.stripe === "complete" || params.stripe === "refresh";

  // Build the initial snapshot server-side so the panel renders real state on
  // first paint instead of flashing a wrong "not connected".
  let account = null;
  let stripeReachable = true;
  if (therapist.stripeConnectedAccountId && isStripeConfigured()) {
    try {
      account = await retrieveAccountOrNull(
        therapist.stripeConnectedAccountId,
      );
    } catch (error) {
      console.error("[settings] Stripe account lookup failed:", error);
      stripeReachable = false;
    }
  }

  const snapshot = deriveConnectStatus(account);
  const initialStripeStatus: ConnectStatusPayload = {
    ...snapshot,
    copy: describeConnectStatus(snapshot.status),
    outstanding: describeOutstandingRequirements(snapshot),
    accountId: account ? therapist.stripeConnectedAccountId : null,
    mode: getStripeKeyMode(),
    stripeConfigured: isStripeConfigured(),
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>

        <Card>
          <CardHeader>
            <CardTitle>Practice Information</CardTitle>
            <CardDescription>
              Update how your name and practice appear to clients.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PracticeInfoPanel
              initial={{
                firstName: therapist.firstName,
                lastName: therapist.lastName,
                credentials: therapist.credentials,
                licenseState: therapist.licenseState,
                practiceName: therapist.practiceName,
                email: therapist.email,
              }}
            />
          </CardContent>
        </Card>

        <Card id="language">
          <CardHeader>
            <CardTitle>Language</CardTitle>
            <CardDescription>
              Choose the display language for the therapist app. This is saved
              on this device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LanguagePanel />
          </CardContent>
        </Card>

        <Card id="stripe">
          <CardHeader>
            <CardTitle>Payment Setup (Stripe Connect)</CardTitle>
            <CardDescription>
              Connect your Stripe account to receive payments from clients.
              SoloPractice charges a 1% platform fee on all payments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!initialStripeStatus.stripeConfigured ? (
              <p className="text-sm text-muted-foreground">
                Payments are not configured on this environment yet.
              </p>
            ) : !stripeReachable ? (
              <p className="text-sm text-destructive">
                Could not reach Stripe to check your payment status. Reload the
                page to try again.
              </p>
            ) : (
              <StripeConnectPanel
                initialStatus={initialStripeStatus}
                justReturned={justReturned}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Consent Forms</CardTitle>
            <CardDescription>
              Review the consent forms sent to clients. All forms are required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConsentFormsPanel
              forms={ALL_CONSENT_TEMPLATES.map((t) => ({
                type: t.type,
                title: t.title,
                version: t.version,
                content: t.content,
              }))}
            />
          </CardContent>
        </Card>

        <Card id="desktop">
          <CardHeader>
            <CardTitle>Desktop App</CardTitle>
            <CardDescription>
              Generate a connection code to connect the SoloPractice desktop app. It syncs
              client contact info and consent status only -- clinical notes and
              recordings never leave the desktop app.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DesktopApiKeyPanel />
          </CardContent>
        </Card>
    </main>
  );
}
