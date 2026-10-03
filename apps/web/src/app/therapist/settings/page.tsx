import { redirect } from "next/navigation";
import Link from "next/link";
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
import { Badge } from "@/components/ui/badge";
import {
  StripeConnectPanel,
  type ConnectStatusPayload,
} from "./stripe-connect-panel";

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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/therapist/dashboard" className="text-muted-foreground hover:text-foreground">
            &larr;
          </Link>
          <h1 className="text-xl font-semibold">Settings</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Practice Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{therapist.firstName} {therapist.lastName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Credentials</p>
                <p className="font-medium">{therapist.credentials}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">License State</p>
                <p className="font-medium">{therapist.licenseState}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{therapist.email}</p>
              </div>
            </div>
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
              View and customize the consent forms sent to clients
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 border-b">
                <span>Informed Consent for Treatment</span>
                <Badge>Required</Badge>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span>Notice of Privacy Practices</span>
                <Badge>Required</Badge>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span>Telehealth Consent</span>
                <Badge variant="outline">Optional</Badge>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span>Session Recording Consent</span>
                <Badge>Required</Badge>
              </div>
              <div className="flex items-center justify-between py-2">
                <span>Limits of Confidentiality</span>
                <Badge>Required</Badge>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              <strong>Note:</strong> Current forms are draft templates for testing.
              Have an attorney review before using with real clients.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
