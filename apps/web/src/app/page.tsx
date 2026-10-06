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
            Run your practice from your phone — intake, schedule, and get paid.
            Session notes stay on your computer.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>For therapists</CardTitle>
              <CardDescription>
                Clients, forms, calendar, and invoices — built for your phone
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckIcon />
                  Send intake forms clients sign online
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon />
                  Schedule sessions with text reminders
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon />
                  Send invoices and get paid
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon />
                  No monthly fee — clients, notes storage, and local offline
                  note AI stay free; only 1% when you get paid (plus card
                  processing)
                </li>
              </ul>
              <Link href="/therapist/login" className="block">
                <Button className={touchStackActionClassName}>Therapist sign in</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>For clients</CardTitle>
              <CardDescription>
                Sign forms and pay invoices — no account needed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckIcon />
                  Sign intake forms online
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon />
                  Pay invoices securely
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon />
                  Use the email link from your therapist
                </li>
              </ul>
              <p className="text-sm text-muted-foreground">
                Check your email for an intake or payment link from your therapist.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3 border-t border-border pt-8 text-center">
          <h2 className="text-lg font-semibold">Already a trial user?</h2>
          <p className="mx-auto max-w-xl text-sm text-muted-foreground">
            Download the desktop app for session recording, notes, and
            superbills — on your computer, not the cloud.
          </p>
          <Link href="/download" className="inline-block w-full sm:w-auto">
            <Button variant="outline" className={touchStackActionClassName}>
              Download the desktop app
            </Button>
          </Link>
        </div>

        <div className="space-y-4 border-t border-border pt-8 text-center">
          <h2 className="text-lg font-semibold">Your privacy matters</h2>
          <div className="flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-4">
            <div className="flex items-center gap-2">
              <ShieldIcon />
              Session notes stay on your computer
            </div>
            <div className="flex items-center gap-2">
              <ShieldIcon />
              Recordings stay on your desktop
            </div>
            <div className="flex items-center gap-2">
              <ShieldIcon />
              Clinical work never syncs to the web
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
