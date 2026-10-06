"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ActionStack,
  touchActionClassName,
  touchStackActionClassName,
} from "@/components/ui/page";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import {
  canEmailInvoiceStatus,
  displayInvoiceStatus,
} from "@/lib/invoice-status";
import { cn } from "@/lib/utils";

export interface InvoiceCardData {
  id: string;
  clientName: string;
  amountCents: number;
  description: string;
  status: string;
  dueDate: string;
  paidAt?: string | null;
  superbillRequestStatus?: "none" | "requested" | "sent" | null;
}

function dueDateInputValue(dueDate: string): string {
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function statusBadge(
  status: string,
  t: (key: string) => string
): {
  variant: "default" | "outline" | "success" | "warning" | "destructive";
  label: string;
} {
  const map: Record<
    string,
    {
      variant: "default" | "outline" | "success" | "warning" | "destructive";
      label: string;
    }
  > = {
    draft: { variant: "default", label: t("invoices.statusDraft") },
    sent: { variant: "warning", label: t("invoices.sent") },
    viewed: { variant: "warning", label: t("invoices.statusViewed") },
    paid: { variant: "success", label: t("invoices.paid") },
    partial: { variant: "warning", label: t("invoices.statusPartial") },
    overdue: { variant: "destructive", label: t("invoices.statusOverdue") },
    cancelled: { variant: "outline", label: t("invoices.statusCancelled") },
    refunded: { variant: "outline", label: t("invoices.statusRefunded") },
  };
  return map[status] || { variant: "outline", label: status };
}

function canDeleteInvoiceStatus(status: string): boolean {
  return status !== "paid" && status !== "refunded";
}

export function InvoiceCard({
  invoice,
  onUpdate,
}: {
  invoice: InvoiceCardData;
  onUpdate: () => void;
}) {
  const { t, language } = useI18n();
  const locale = language === "en" ? "en-US" : language;
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendInfo, setSendInfo] = useState("");
  const [actionError, setActionError] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function sendInvoice() {
    setSending(true);
    setSendError("");
    setSendInfo("");
    setActionError("");
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/send`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : t("invoices.sendFailed")
        );
      }
      const to = typeof data.to === "string" ? data.to : "";
      setSendInfo(
        to
          ? t("invoices.emailedTo").replace("{email}", to)
          : t("invoices.sendSucceeded")
      );
      onUpdate();
    } catch (err) {
      setSendError(
        err instanceof Error ? err.message : t("invoices.sendFailed")
      );
    } finally {
      setSending(false);
    }
  }

  async function deleteInvoice() {
    setDeleting(true);
    setActionError("");
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : t("invoices.deleteFailed")
        );
      }
      setConfirmDelete(false);
      onUpdate();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : t("invoices.deleteFailed")
      );
    } finally {
      setDeleting(false);
    }
  }

  const shownStatus = displayInvoiceStatus(invoice.status, invoice.dueDate);
  const badge = statusBadge(shownStatus, t);
  const isDraft = invoice.status === "draft";
  const canEmail =
    canEmailInvoiceStatus(invoice.status) ||
    canEmailInvoiceStatus(shownStatus);
  const canDelete = canDeleteInvoiceStatus(invoice.status);
  const hasActions = isDraft || canEmail || canDelete;

  return (
    <>
      <Card className="p-4">
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h3 className="truncate text-base font-semibold leading-tight">
                  {invoice.clientName}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {invoice.description}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <Badge
                  variant={badge.variant}
                  className="px-3 py-1 text-sm"
                  aria-label={`${t("invoices.status")}: ${badge.label}`}
                >
                  {badge.label}
                </Badge>
                {invoice.superbillRequestStatus === "requested" && (
                  <Badge
                    variant="warning"
                    className="px-2 py-0.5 text-xs"
                    aria-label={t("invoices.superbillRequested")}
                  >
                    {t("invoices.superbillRequested")}
                  </Badge>
                )}
                {invoice.superbillRequestStatus === "sent" && (
                  <Badge
                    variant="outline"
                    className="px-2 py-0.5 text-xs"
                    aria-label={t("invoices.superbillSent")}
                  >
                    {t("invoices.superbillSent")}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-end justify-between gap-3">
              <p className="text-2xl font-semibold tabular-nums">
                ${(invoice.amountCents / 100).toFixed(2)}
              </p>
              <p className="text-right text-sm text-muted-foreground">
                {invoice.paidAt
                  ? `${t("invoices.paidAt")} ${new Date(
                      invoice.paidAt
                    ).toLocaleDateString(locale)}`
                  : `${t("invoices.due")} ${new Date(
                      invoice.dueDate
                    ).toLocaleDateString(locale)}`}
              </p>
            </div>

            {hasActions && (
              <ActionStack>
                {isDraft && (
                  <Button
                    size="md"
                    variant="outline"
                    className={touchStackActionClassName}
                    onClick={() => setEditing(true)}
                  >
                    {t("common.edit")}
                  </Button>
                )}
                {canEmail && (
                  <Button
                    size="md"
                    className={touchStackActionClassName}
                    variant={isDraft ? "primary" : "secondary"}
                    onClick={sendInvoice}
                    loading={sending}
                  >
                    {isDraft
                      ? t("invoices.sendInvoice")
                      : t("invoices.resendInvoice")}
                  </Button>
                )}
                {canDelete && (
                  <Button
                    size="md"
                    variant="outline"
                    className={cn(
                      touchStackActionClassName,
                      "border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    )}
                    onClick={() => {
                      setActionError("");
                      setConfirmDelete(true);
                    }}
                  >
                    {t("common.delete")}
                  </Button>
                )}
              </ActionStack>
            )}
          </div>
          {sendError && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {sendError}
            </p>
          )}
          {actionError && !confirmDelete && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {actionError}
            </p>
          )}
          {sendInfo && !sendError && (
            <p className="mt-3 text-sm text-muted-foreground" role="status">
              {sendInfo}
            </p>
          )}
        </CardContent>
      </Card>

      {isDraft && (
        <Dialog open={editing} onOpenChange={setEditing}>
          <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-md flex-col gap-0 overflow-hidden p-0 sm:rounded-lg">
            <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-4 pr-12 text-left">
              <DialogTitle>{t("invoices.editDraft")}</DialogTitle>
              <DialogDescription>{t("invoices.editDraftDesc")}</DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto px-6 py-4">
              <EditInvoiceForm
                invoice={invoice}
                onCancel={() => setEditing(false)}
                onSuccess={() => {
                  setEditing(false);
                  onUpdate();
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog
        open={confirmDelete}
        onOpenChange={(open) => {
          setConfirmDelete(open);
          if (!open) setActionError("");
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-md sm:rounded-lg">
          <DialogHeader className="text-left">
            <DialogTitle>{t("invoices.deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {isDraft
                ? t("invoices.deleteConfirmDraft")
                : t("invoices.deleteConfirmSent")}
            </DialogDescription>
          </DialogHeader>
          {actionError && (
            <p className="text-sm text-destructive" role="alert">
              {actionError}
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className={touchActionClassName}
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className={touchActionClassName}
              loading={deleting}
              onClick={deleteInvoice}
            >
              {t("invoices.deleteConfirmAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditInvoiceForm({
  invoice,
  onCancel,
  onSuccess,
}: {
  invoice: InvoiceCardData;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const amountDollars = parseFloat(formData.get("amount") as string);

    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: Math.round(amountDollars * 100),
          description: formData.get("description"),
          dueDate: formData.get("dueDate"),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update invoice");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">{t("invoices.client")}</p>
        <p className="font-medium">{invoice.clientName}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          name="amount"
          type="number"
          step="0.01"
          min="1"
          label={t("invoices.amountDollars")}
          defaultValue={(invoice.amountCents / 100).toFixed(2)}
          required
        />
        <Input
          name="dueDate"
          type="date"
          label={t("invoices.dueDate")}
          defaultValue={dueDateInputValue(invoice.dueDate)}
          required
        />
      </div>
      <Input
        name="description"
        label={t("invoices.description")}
        defaultValue={invoice.description}
        required
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ActionStack className="flex-col-reverse sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className={touchActionClassName}
          onClick={onCancel}
        >
          {t("common.cancel")}
        </Button>
        <Button
          type="submit"
          loading={loading}
          className={touchActionClassName}
        >
          {t("invoices.saveChanges")}
        </Button>
      </ActionStack>
    </form>
  );
}
