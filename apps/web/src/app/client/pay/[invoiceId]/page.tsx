import { notFound } from "next/navigation";
import { db, invoices } from "@/db";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CenteredShell } from "@/components/ui/page";
import { PayButton } from "./pay-button";
import { ReceiptSuperbill } from "./receipt-superbill";

interface PageProps {
  params: Promise<{ invoiceId: string }>;
  searchParams: Promise<{ success?: string; cancelled?: string }>;
}

export default async function PaymentPage({ params, searchParams }: PageProps) {
  const { invoiceId } = await params;
  const { success, cancelled } = await searchParams;

  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.id, invoiceId),
    with: {
      client: true,
      therapist: true,
    },
  });

  if (!invoice) {
    notFound();
  }

  const isPaid = invoice.status === "paid";
  const showSuccess = success === "true";
  const showCancelled = cancelled === "true";
  const practiceName =
    invoice.therapist.practiceName ||
    `${invoice.therapist.firstName} ${invoice.therapist.lastName}`;
  const showReceipt = isPaid || showSuccess;

  return (
    <CenteredShell>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {showReceipt ? "Payment received" : "Pay invoice"}
          </CardTitle>
          <CardDescription>{practiceName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {showReceipt ? (
            <ReceiptSuperbill
              invoiceId={invoice.id}
              amountCents={invoice.amountCents}
              description={invoice.description}
              practiceName={practiceName}
              paidAt={invoice.paidAt?.toISOString() ?? null}
              initialStatus={
                isPaid ? (invoice.superbillRequestStatus ?? "none") : "none"
              }
              initialRequestedAt={
                isPaid
                  ? (invoice.superbillRequestedAt?.toISOString() ?? null)
                  : null
              }
              initialSentAt={
                isPaid ? (invoice.superbillSentAt?.toISOString() ?? null) : null
              }
              canRequest={isPaid}
            />
          ) : (
            <>
              {showCancelled ? (
                <div className="py-4 text-center">
                  <p className="mb-4 text-muted-foreground">
                    Payment was cancelled. You can try again below.
                  </p>
                </div>
              ) : null}

              <div className="space-y-3">
                <div className="flex justify-between gap-4">
                  <span className="shrink-0 text-muted-foreground">Client</span>
                  <span className="min-w-0 text-right">
                    {invoice.client.firstName} {invoice.client.lastName}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="shrink-0 text-muted-foreground">Description</span>
                  <span className="min-w-0 break-words text-right">
                    {invoice.description}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="shrink-0 text-muted-foreground">Due</span>
                  <span className="min-w-0 text-right">
                    {new Date(invoice.dueDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 border-t pt-3">
                  <span className="shrink-0 font-medium">Amount due</span>
                  <span className="text-2xl font-bold">
                    ${(invoice.amountCents / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              <PayButton invoiceId={invoice.id} />

              <p className="text-center text-xs text-muted-foreground">
                Secure card payment.
              </p>
            </>
          )}

          {!showReceipt && isPaid && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between gap-4">
                <span>Status</span>
                <Badge variant="success">Paid</Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </CenteredShell>
  );
}
