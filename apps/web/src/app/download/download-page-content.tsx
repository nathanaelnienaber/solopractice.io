"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    <main className="flex min-h-screen flex-col items-center p-8">
      <div className="max-w-3xl w-full space-y-10 py-12">
        <div className="text-center space-y-4">
          <Badge variant="default">Free during trial</Badge>
          <h1 className="text-4xl font-bold tracking-tight">
            Download the SoloPractice app
          </h1>
          <p className="text-xl text-muted-foreground max-w-xl mx-auto">
            This is the app you’ll use every day for clinical work — clients,
            session recording, notes, and superbills. Scheduling and invoices
            stay on the web portal. Clinical notes never leave this computer.
          </p>
        </div>

        <Card className="border-primary/30">
          <CardContent className="space-y-4 pt-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm text-muted-foreground">
                  {detectedOs ? "We think you’re using" : "Choose your computer"}
                </p>
                <CardTitle className="text-2xl">{OS_LABEL[featured]}</CardTitle>
                <CardDescription>{OS_COPY[featured]}</CardDescription>
              </div>
              <a href={DOWNLOAD_URLS[featured]} download>
                <Button size="lg" className="whitespace-nowrap">
                  Download for {OS_LABEL[featured]}
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground text-center">
            Using a different computer?
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {secondary.map((os) => (
              <a key={os} href={DOWNLOAD_URLS[os]} download>
                <Button variant="outline">Download for {OS_LABEL[os]}</Button>
              </a>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {GATEKEEPER_NOTE[featured].title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {GATEKEEPER_NOTE[featured].body}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-3">
              This warning shows up because we haven’t registered the app
              with Apple/Microsoft yet — it doesn’t mean anything is wrong.
              Nothing is uploaded anywhere without your say-so; your clinical
              notes stay on your computer.
            </p>
          </CardContent>
        </Card>

        {DOWNLOAD_URLS_ARE_PLACEHOLDERS && process.env.NODE_ENV !== "production" && (
          <p className="text-xs text-warning text-center">
            Dev-only notice (hidden in production): download hrefs are still
            placeholders in download-urls.ts — swap in the real release
            asset URLs before this ships.
          </p>
        )}
      </div>
    </main>
  );
}
