import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CenteredShell,
  touchStackActionClassName,
} from "@/components/ui/page";

export default function HomePage() {
  return (
    <CenteredShell className="items-stretch sm:items-center">
      <div className="mx-auto w-full max-w-4xl space-y-8 py-4">
        <div className="space-y-4 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">SoloPractice</h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Local-first therapy practice management.
            Clinical data stays on your desktop — always.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
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
                  Invoice clients and get paid
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon />
                  1% on payments only — clients, notes, and local AI stay free
                </li>
              </ul>
              <Link href="/therapist/login" className="block">
                <Button className={touchStackActionClassName}>Therapist Sign In</Button>
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
                  Pay invoices securely
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon />
                  No account needed — use the email link from your therapist
                </li>
              </ul>
              <p className="text-sm text-muted-foreground">
                Check your email for a consent or payment link from your therapist.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3 border-t border-border pt-8 text-center">
          <h2 className="text-lg font-semibold">Already a trial user?</h2>
          <p className="mx-auto max-w-xl text-sm text-muted-foreground">
            Get the desktop app to manage clients, appointments, and your
            clinical notes — right from your own computer.
          </p>
          <Link href="/download" className="inline-block w-full sm:w-auto">
            <Button variant="outline" className={touchStackActionClassName}>
              Download the desktop app
            </Button>
          </Link>
        </div>

        <div className="space-y-4 border-t border-border pt-8 text-center">
          <h2 className="text-lg font-semibold">Security First</h2>
          <div className="flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-4">
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
              Clinical chart never syncs to the web
            </div>
          </div>
        </div>
      </div>
    </CenteredShell>
  );
}

function CheckIcon() {
  return (
    <svg
      className="h-4 w-4 flex-shrink-0 text-success"
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
      className="h-4 w-4 flex-shrink-0 text-primary"
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
