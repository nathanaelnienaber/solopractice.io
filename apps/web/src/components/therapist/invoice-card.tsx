"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";

export interface InvoiceCardData {
  id: string;
  clientName: string;
  amountCents: number;
  description: string;
  status: string;
  dueDate: string;
  paidAt?: string | null;
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
): { variant: "outline" | "success" | "warning" | "destructive"; label: string } {
  const map: Record<
    string,
    { variant: "outline" | "success" | "warning" | "destructive"; label: string }
  > = {
    draft: { variant: "outline", label: t("invoices.statusDraft") },
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
  const [sendError, setSendError] = useState("");
  const [sendInfo, setSendInfo] = useState("");
  const [editing, setEditing] = useState(false);

  async function sendInvoice() {
    setSending(true);
    setSendError("");
    setSendInfo("");
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
      const emailId = typeof data.emailId === "string" ? data.emailId : "";
      setSendInfo(
        to
          ? t("invoices.emailedTo").replace("{email}", to) +
              (emailId ? ` (${emailId})` : "")
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

  const badge = statusBadge(invoice.status, t);
  const isDraft = invoice.status === "draft";
  const canEmail =
    invoice.status === "draft" ||
    invoice.status === "sent" ||
    invoice.status === "viewed";

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <h3 className="font-medium">{invoice.clientName}</h3>
              <p className="text-sm text-muted-foreground">{invoice.description}</p>
              <p className="text-sm text-muted-foreground">
                {t("invoices.due")}:{" "}
                {new Date(invoice.dueDate).toLocaleDateString(locale)}
                {invoice.paidAt
                  ? ` · ${t("invoices.paidAt")} ${new Date(
                      invoice.paidAt
                    ).toLocaleDateString(locale)}`
                  : ""}
              </p>
            </div>
            <div className="flex flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
              <div className="flex flex-col items-start gap-1 sm:items-end">
                <p className="text-xl font-semibold">
                  ${(invoice.amountCents / 100).toFixed(2)}
                </p>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </div>
              {canEmail && (
                <div className="flex flex-col gap-2 sm:w-full sm:min-w-[8.5rem]">
                  {isDraft && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => setEditing(true)}
                    >
                      {t("common.edit")}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="w-full"
                    variant={isDraft ? "default" : "outline"}
                    onClick={sendInvoice}
                    loading={sending}
                  >
                    {isDraft
                      ? t("invoices.sendInvoice")
                      : t("invoices.resendInvoice")}
                  </Button>
                </div>
              )}
            </div>
          </div>
          {sendError && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {sendError}
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
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={onCancel}
        >
          {t("common.cancel")}
        </Button>
        <Button type="submit" loading={loading} className="w-full sm:w-auto">
          {t("invoices.saveChanges")}
        </Button>
      </div>
    </form>
  );
}
