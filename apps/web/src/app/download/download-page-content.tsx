"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ActionStack,
  PageHeader,
  PageShell,
  touchActionClassName,
  touchStackActionClassName,
} from "@/components/ui/page";
import { DOWNLOAD_URLS, DOWNLOAD_URLS_ARE_PLACEHOLDERS, type DesktopOs } from "./download-urls";
import { useDetectedOs } from "./use-detected-os";

const OS_LABEL: Record<DesktopOs, string> = {
  mac: "Mac",
  windows: "Windows",
  linux: "Linux",
};

const OS_COPY: Record<DesktopOs, string> = {
  mac: "For MacBooks and iMacs",
  windows: "For Windows PCs and laptops",
  linux: "For Linux desktops",
};

const GATEKEEPER_NOTE: Record<DesktopOs, { title: string; body: string }> = {
  mac: {
    title: "First time opening it on a Mac",
    body:
      "macOS will say the app is from an \"unidentified developer\" — that's expected, we haven't finished Apple's paid notarization process yet. To open it: right-click (or Control-click) the SoloPractice icon, choose Open, then confirm Open on the popup. You only need to do this once.",
  },
  windows: {
    title: "First time opening it on Windows",
    body:
      "Windows SmartScreen may show a blue \"Windows protected your PC\" screen — that's expected for a new app that isn't registered with Microsoft yet. Click \"More info\", then \"Run anyway\". You only need to do this once.",
  },
  linux: {
    title: "First time running it on Linux",
    body:
      "You may need to mark the downloaded file as executable before it will run (most file managers have a \"Properties → Allow executing\" checkbox, or run chmod +x on it from a terminal). You only need to do this once.",
  },
};

export function DownloadPageContent() {
  const detectedOs = useDetectedOs();
  // Default the "featured" slot to mac during the brief window before
  // client-side detection resolves, so the layout doesn't jump/flash.
  const featured: DesktopOs = detectedOs ?? "mac";
  const secondary = (["mac", "windows", "linux"] as const).filter((os) => os !== featured);

  return (
    <PageShell className="max-w-3xl space-y-10 py-12">
      <PageHeader
        title="Download the SoloPractice app"
        description="This is the app you’ll use every day for clinical work — clients, session recording, notes, and superbills. Scheduling and invoices stay on the web portal. Clinical notes never leave this computer."
        eyebrow={<Badge variant="default">Free during trial</Badge>}
      />

      <Card className="border-primary/30">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-sm text-muted-foreground">
                {detectedOs ? "We think you’re using" : "Choose your computer"}
              </p>
              <CardTitle className="text-2xl">{OS_LABEL[featured]}</CardTitle>
              <CardDescription>{OS_COPY[featured]}</CardDescription>
            </div>
            <a href={DOWNLOAD_URLS[featured]} download className="w-full sm:w-auto">
              <Button size="lg" className={touchActionClassName}>
                Download for {OS_LABEL[featured]}
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <p className="text-center text-sm text-muted-foreground">
          Using a different computer?
        </p>
        <ActionStack className="sm:flex-row sm:justify-center">
          {secondary.map((os) => (
            <a key={os} href={DOWNLOAD_URLS[os]} download className="w-full sm:w-auto">
              <Button variant="outline" className={touchStackActionClassName}>
                Download for {OS_LABEL[os]}
              </Button>
            </a>
          ))}
        </ActionStack>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {GATEKEEPER_NOTE[featured].title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {GATEKEEPER_NOTE[featured].body}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            This warning shows up because we haven’t registered the app
            with Apple/Microsoft yet — it doesn’t mean anything is wrong.
            Nothing is uploaded anywhere without your say-so; your clinical
            notes stay on your computer.
          </p>
        </CardContent>
      </Card>

      {DOWNLOAD_URLS_ARE_PLACEHOLDERS && process.env.NODE_ENV !== "production" && (
        <p className="text-center text-xs text-warning">
          Dev-only notice (hidden in production): download hrefs are still
          placeholders in download-urls.ts — swap in the real release
          asset URLs before this ships.
        </p>
      )}
    </PageShell>
  );
}
