import { notFound } from "next/navigation";
import { db, invoices } from "@/db";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CenteredShell } from "@/components/ui/page";
import { PayButton } from "./pay-button";

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

  return (
    <CenteredShell>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {isPaid || showSuccess ? "Payment received" : "Pay invoice"}
          </CardTitle>
          <CardDescription>
            {invoice.therapist.practiceName ||
              `${invoice.therapist.firstName} ${invoice.therapist.lastName}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {showSuccess || isPaid ? (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                <svg
                  className="h-8 w-8 text-success"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
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
                Your payment was received. Contact your therapist if you need a
                receipt.
              </p>
            </div>
          ) : showCancelled ? (
            <div className="py-4 text-center">
              <p className="mb-4 text-muted-foreground">
                Payment was cancelled. You can try again below.
              </p>
            </div>
          ) : null}

          {!isPaid && !showSuccess && (
            <>
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
                  <span className="shrink-0 font-medium">Amount Due</span>
                  <span className="text-2xl font-bold">
                    ${(invoice.amountCents / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              <PayButton invoiceId={invoice.id} />

              <p className="text-center text-xs text-muted-foreground">
                Secure payment. Includes a 1% SoloPractice fee (plus normal card
                processing).
              </p>
            </>
          )}

          {isPaid && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between gap-4">
                <span>Status</span>
                <Badge variant="success">Paid</Badge>
              </div>
              {invoice.paidAt && (
                <div className="mt-2 flex justify-between gap-4 text-sm text-muted-foreground">
                  <span>Paid on</span>
                  <span>{new Date(invoice.paidAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </CenteredShell>
  );
}
