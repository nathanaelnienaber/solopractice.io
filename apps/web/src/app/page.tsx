import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">SoloPractice</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Local-first therapy practice management.
            Clinical data stays on your desktop — always.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>For Therapists</CardTitle>
              <CardDescription>
                Manage your practice, send invoices, and track consents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckIcon />
                  Client intake and consent e-signatures
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon />
                  Appointment scheduling with SMS reminders
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon />
                  Invoice clients via Stripe
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon />
                  1% platform fee, no monthly costs
                </li>
              </ul>
              <Link href="/therapist/login">
                <Button className="w-full">Therapist Sign In</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>For Clients</CardTitle>
              <CardDescription>
                Complete intake forms and pay invoices securely
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckIcon />
                  Sign consent forms online
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon />
                  View upcoming appointments
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon />
                  Pay invoices securely
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon />
                  No account needed — magic link access
                </li>
              </ul>
              <p className="text-sm text-muted-foreground">
                Check your email for a link from your therapist.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center space-y-4 pt-8 border-t border-border">
          <h2 className="text-lg font-semibold">Security First</h2>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <ShieldIcon />
              Clinical notes stay on desktop
            </div>
            <div className="flex items-center gap-2">
              <ShieldIcon />
              Session recordings never uploaded
            </div>
            <div className="flex items-center gap-2">
              <ShieldIcon />
              SOAP, Dx, CPT codes never sync
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function CheckIcon() {
  return (
    <svg
      className="h-4 w-4 text-success flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      className="h-4 w-4 text-primary flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
    </svg>
  );
}
