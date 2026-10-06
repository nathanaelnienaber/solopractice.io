"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionStack, touchStackActionClassName } from "@/components/ui/page";

export type SuperbillRequestStatus = "none" | "requested" | "sent";

interface ReceiptSuperbillProps {
  invoiceId: string;
  amountCents: number;
  description: string;
  practiceName: string;
  paidAt: string | null;
  initialStatus: SuperbillRequestStatus;
  initialRequestedAt: string | null;
  initialSentAt: string | null;
  /** False while Stripe success redirect races the webhook. */
  canRequest?: boolean;
}

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ReceiptSuperbill({
  invoiceId,
  amountCents,
  description,
  practiceName,
  paidAt,
  initialStatus,
  initialRequestedAt,
  initialSentAt,
  canRequest = true,
}: ReceiptSuperbillProps) {
  const [status, setStatus] = useState<SuperbillRequestStatus>(initialStatus);
  const [requestedAt, setRequestedAt] = useState<string | null>(
    initialRequestedAt
  );
  const [sentAt, setSentAt] = useState<string | null>(initialSentAt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function requestSuperbill() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/superbill-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Couldn't request superbill"
        );
      }
      setStatus(
        (data.superbillRequestStatus as SuperbillRequestStatus) ?? "requested"
      );
      setRequestedAt(
        typeof data.superbillRequestedAt === "string"
          ? data.superbillRequestedAt
          : requestedAt
      );
      if (typeof data.superbillSentAt === "string") {
        setSentAt(data.superbillSentAt);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't request superbill");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="py-2 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <svg
            className="h-8 w-8 text-success"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <p className="text-lg font-medium">Thank you — you&apos;re all set.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Payment received. Your therapist prepares superbills on their computer
          — they never upload to this site.
        </p>
      </div>

      <div className="space-y-3 border-t pt-4">
        <div className="flex justify-between gap-4">
          <span className="shrink-0 text-muted-foreground">Practice</span>
          <span className="min-w-0 text-right">{practiceName}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="shrink-0 text-muted-foreground">Session</span>
          <span className="min-w-0 break-words text-right">{description}</span>
        </div>
        {paidAt && (
          <div className="flex justify-between gap-4">
            <span className="shrink-0 text-muted-foreground">Paid on</span>
            <span className="min-w-0 text-right">
              {new Date(paidAt).toLocaleDateString()}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between gap-4 border-t pt-3">
          <span className="shrink-0 font-medium">Amount paid</span>
          <span className="text-2xl font-bold tabular-nums">
            {formatMoney(amountCents)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">Status</span>
          <Badge variant="success">Paid</Badge>
        </div>
      </div>

      <div className="space-y-3 border-t pt-4">
        <h2 className="text-base font-medium">Superbill</h2>
        {status === "none" && (
          <>
            <p className="text-sm text-muted-foreground">
              Need a superbill for insurance? Request one — your therapist
              prepares it on their computer and shares it with you.
            </p>
            {canRequest ? (
              <ActionStack>
                <Button
                  variant="primary"
                  className={touchStackActionClassName}
                  loading={loading}
                  onClick={requestSuperbill}
                >
                  Request superbill
                </Button>
              </ActionStack>
            ) : (
              <p className="text-sm text-muted-foreground">
                Confirming payment… refresh in a moment to request a superbill.
              </p>
            )}
          </>
        )}
        {status === "requested" && (
          <div className="space-y-2">
            <Badge variant="warning">Superbill requested</Badge>
            <p className="text-sm text-muted-foreground">
              Requested
              {requestedAt
                ? ` on ${new Date(requestedAt).toLocaleDateString()}`
                : ""}
              . Your therapist will prepare it and share it with you.
            </p>
          </div>
        )}
        {status === "sent" && (
          <div className="space-y-2">
            <Badge variant="success">Superbill sent</Badge>
            <p className="text-sm text-muted-foreground">
              Your therapist marked the superbill as sent
              {sentAt ? ` on ${new Date(sentAt).toLocaleDateString()}` : ""}.
              Check your email or ask them if you don&apos;t see it.
            </p>
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
