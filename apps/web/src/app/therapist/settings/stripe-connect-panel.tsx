"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  ConnectStatus,
  ConnectStatusSnapshot,
} from "@/lib/stripe-connect-status";

interface StatusCopy {
  label: string;
  detail: string;
  tone: "neutral" | "warning" | "success";
}

export interface ConnectStatusPayload extends ConnectStatusSnapshot {
  copy: StatusCopy;
  outstanding: string[];
  accountId?: string | null;
  mode?: string;
  stripeConfigured?: boolean;
}

const TONE_VARIANT: Record<StatusCopy["tone"], "default" | "warning" | "success"> =
  {
    neutral: "default",
    warning: "warning",
    success: "success",
  };

/** Statuses where Stripe may still be settling, so polling can resolve them. */
const TRANSIENT: ConnectStatus[] = [
  "pending_verification",
  "ready_payouts_pending",
];

export function StripeConnectPanel({
  initialStatus,
  justReturned,
}: {
  initialStatus: ConnectStatusPayload;
  /** True when Stripe redirected back to us (?stripe=complete|refresh). */
  justReturned?: boolean;
}) {
  const [status, setStatus] = useState<ConnectStatusPayload>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollsRef = useRef(0);

  const refresh = useCallback(async (): Promise<ConnectStatusPayload | null> => {
    try {
      const res = await fetch("/api/stripe/connect/status", {
        cache: "no-store",
      });
      if (!res.ok) return null;
      const next = (await res.json()) as ConnectStatusPayload;
      setStatus(next);
      return next;
    } catch {
      return null;
    }
  }, []);

  // After returning from Stripe's hosted flow the `account.updated` webhook is
  // often still in flight, so the server-rendered snapshot can be a step behind.
  // Poll briefly (bounded) until the status settles.
  useEffect(() => {
    const shouldPoll =
      justReturned ||
      TRANSIENT.includes(status.status) ||
      (status.detailsSubmitted && !status.canAcceptPayments);

    if (!shouldPoll || pollsRef.current >= 5) return;

    const timer = setTimeout(async () => {
      pollsRef.current += 1;
      const next = await refresh();
      if (next && next.status === "ready") pollsRef.current = 99;
    }, 2000);

    return () => clearTimeout(timer);
  }, [justReturned, status, refresh]);

  async function startOnboarding() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const payload = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
        code?: string;
      };

      if (!res.ok || !payload.url) {
        setError(
          payload.code === "live_mode_blocked"
            ? "Payment onboarding is disabled on this environment pending owner approval."
            : payload.error || "Could not start Stripe onboarding.",
        );
        return;
      }

      window.location.href = payload.url;
    } catch {
      setError("Could not reach Stripe. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const { copy } = status;
  const isTestMode = status.mode === "test";

  const ctaLabel =
    status.status === "not_connected"
      ? "Connect with Stripe"
      : status.status === "onboarding_incomplete"
        ? "Continue Stripe onboarding"
        : status.status === "restricted"
          ? "Provide required information"
          : "Manage Stripe details";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={TONE_VARIANT[copy.tone]}>{copy.label}</Badge>
        {isTestMode && (
          <Badge variant="outline" title="No real money moves in test mode">
            Stripe test mode
          </Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{copy.detail}</p>

      {status.outstanding.length > 0 && (
        <div className="rounded-md border border-border p-3">
          <p className="text-sm font-medium">Stripe still needs:</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
            {status.outstanding.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {status.detailsSubmitted && (
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="flex items-center gap-2">
            Accept payments:
            <Badge variant={status.chargesEnabled ? "success" : "warning"}>
              {status.chargesEnabled ? "Enabled" : "Pending"}
            </Badge>
          </span>
          <span className="flex items-center gap-2">
            Bank payouts:
            <Badge variant={status.payoutsEnabled ? "success" : "warning"}>
              {status.payoutsEnabled ? "Enabled" : "Pending"}
            </Badge>
          </span>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        {status.status !== "ready" && (
          <Button onClick={startOnboarding} loading={loading}>
            {ctaLabel}
          </Button>
        )}
        {status.detailsSubmitted && (
          <Button
            variant="secondary"
            onClick={() => {
              pollsRef.current = 0;
              void refresh();
            }}
          >
            Refresh status
          </Button>
        )}
      </div>
    </div>
  );
}
