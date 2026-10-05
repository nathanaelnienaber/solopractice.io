"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface KeyStatus {
  hasApiKey: boolean;
  createdAt: string | null;
  keyPreview: string | null;
}

/**
 * Desktop App API key panel.
 *
 * Shows whether a key already exists (preview + created date only -- the
 * full key is never returned by GET, see /api/therapist/desktop-api-key).
 * "Generate New Key" calls POST, which returns the full key exactly once;
 * it is held only in this component's React state for the current render
 * and is never logged or persisted anywhere else in the app.
 */
export function DesktopApiKeyPanel() {
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only ever set from a POST response, in-memory only. Never sent back to
  // the server, never logged, cleared when the user navigates away.
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/therapist/desktop-api-key", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load API key status");
      const data = (await res.json()) as KeyStatus;
      setStatus(data);
    } catch {
      setError("Could not load API key status. Reload the page to try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function generateKey() {
    const confirmed = status?.hasApiKey
      ? window.confirm(
          "Generating a new key will immediately invalidate the old one. Any desktop app using the old key will stop syncing until you update it. Continue?"
        )
      : true;
    if (!confirmed) return;

    setGenerating(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch("/api/therapist/desktop-api-key", { method: "POST" });
      if (!res.ok) throw new Error("Could not generate a new key");
      const data = (await res.json()) as { apiKey: string; createdAt: string };
      setRevealedKey(data.apiKey);
      await loadStatus();
    } catch {
      setError("Could not generate a new key. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function copyKey() {
    if (!revealedKey) return;
    try {
      await navigator.clipboard.writeText(revealedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (permissions/non-HTTPS context);
      // the key is still visible and selectable in the code block.
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {revealedKey ? (
        <div className="space-y-3 rounded-lg border border-warning/50 bg-warning/5 p-4">
          <p className="text-sm font-medium text-warning">
            Copy this code now -- you will not be able to see it again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-muted px-3 py-2 text-sm font-mono select-all">
              {revealedKey}
            </code>
            <Button type="button" variant="outline" onClick={copyKey}>
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Paste this into the SoloPractice desktop app -- either during setup, or later under
            Settings &rarr; Advanced settings &rarr; Web Portal Connection &rarr; Connection
            code -- then click &ldquo;Sync Now&rdquo;.
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setRevealedKey(null)}>
            Done, I've saved it
          </Button>
        </div>
      ) : status?.hasApiKey ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2 border-b">
            <div>
              <p className="text-sm font-medium">
                <code className="font-mono">{status.keyPreview}</code>
              </p>
              <p className="text-xs text-muted-foreground">
                Created{" "}
                {status.createdAt ? new Date(status.createdAt).toLocaleDateString() : "unknown"}
              </p>
            </div>
            <Badge>Active</Badge>
          </div>
          <Button type="button" variant="outline" onClick={generateKey} disabled={generating}>
            {generating ? "Generating..." : "Generate New Code"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            No connection code yet. Generate one to connect the SoloPractice desktop app to
            your account, so your client contact info and consent status stay in sync.
          </p>
          <Button type="button" onClick={generateKey} disabled={generating}>
            {generating ? "Generating..." : "Generate Connection Code"}
          </Button>
        </div>
      )}
    </div>
  );
}
