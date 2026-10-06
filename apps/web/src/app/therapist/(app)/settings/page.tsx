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
import { PageHeader, PageShell } from "@/components/ui/page";
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
    <PageShell>
      <PageHeader title="Settings" />

      <Card>
        <CardHeader>
          <CardTitle>Practice information</CardTitle>
          <CardDescription>
            How your name and practice appear to clients on forms and invoices.
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
          <CardTitle>Payment Setup</CardTitle>
          <CardDescription>
            Get set up to receive payments from clients. SoloPractice&apos;s
            only cost is 1% on payments you collect, plus normal card
            processing — no monthly fee, and no charge for clients, notes
            storage, or local offline note AI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!initialStripeStatus.stripeConfigured ? (
            <p className="text-sm text-muted-foreground">
              Payments are not configured on this environment yet.
            </p>
          ) : !stripeReachable ? (
            <p className="text-sm text-destructive">
              Could not check your payment status right now. Reload the page
              to try again.
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
          <CardTitle>Intake forms</CardTitle>
          <CardDescription>
            Review the forms clients sign before starting. All five are
            required. Templates are drafts until an attorney reviews them for
            your practice.
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

      <Card id="sms-reminders">
        <CardHeader>
          <CardTitle>Text appointment reminders</CardTitle>
          <CardDescription>
            Automatic texts go out about 24 hours before an appointment when
            the client has a phone number and no reminder has been sent yet.
            You can also send one anytime from the calendar with Send Reminder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            If automatic reminders aren&apos;t arriving, texting may not be
            enabled for this account yet. Contact support if you need it turned
            on.
          </p>
        </CardContent>
      </Card>

      <Card id="desktop">
        <CardHeader>
          <CardTitle>Desktop app</CardTitle>
          <CardDescription>
            Generate a connection code for the SoloPractice desktop app. It
            updates client contact info and form status only — clinical notes
            and recordings never leave the desktop.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DesktopApiKeyPanel />
        </CardContent>
      </Card>
    </PageShell>
  );
}
