import { notFound, redirect } from "next/navigation";
import { db, invoices, clients, therapists } from "@/db";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    <main className="min-h-screen bg-background flex items-center justify-center p-8">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>
            {isPaid || showSuccess ? "Payment Complete" : "Pay Invoice"}
          </CardTitle>
          <CardDescription>
            {invoice.therapist.practiceName ||
              `${invoice.therapist.firstName} ${invoice.therapist.lastName}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {showSuccess || isPaid ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-success"
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
              <p className="text-lg font-medium">Thank you for your payment!</p>
              <p className="text-sm text-muted-foreground mt-2">
                Your payment was received. Contact your therapist if you need a
                receipt.
              </p>
            </div>
          ) : showCancelled ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">
                Payment was cancelled. You can try again below.
              </p>
            </div>
          ) : null}

          {!isPaid && !showSuccess && (
            <>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client</span>
                  <span>
                    {invoice.client.firstName} {invoice.client.lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Description</span>
                  <span>{invoice.description}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due</span>
                  <span>{new Date(invoice.dueDate).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t">
                  <span className="font-medium">Amount Due</span>
                  <span className="text-2xl font-bold">
                    ${(invoice.amountCents / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              <PayButton invoiceId={invoice.id} />

              <p className="text-xs text-muted-foreground text-center">
                Secure payment powered by Stripe. A 1% platform fee applies.
              </p>
            </>
          )}

          {isPaid && (
            <div className="pt-4 border-t">
              <div className="flex justify-between items-center">
                <span>Status</span>
                <Badge variant="success">Paid</Badge>
              </div>
              {invoice.paidAt && (
                <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                  <span>Paid on</span>
                  <span>{new Date(invoice.paidAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
