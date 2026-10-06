import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionTherapist } from "@/lib/auth";
import { db, clients, invoices, appointments } from "@/db";
import { eq, and, desc, gte, count } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PageHeader,
  PageShell,
  touchActionClassName,
} from "@/components/ui/page";
import { REQUIRED_CONSENT_TEMPLATES } from "@/lib/consent-templates";
import { cn } from "@/lib/utils";

export default async function TherapistDashboard() {
  const therapist = await getSessionTherapist();

  if (!therapist) {
    redirect("/therapist/login");
  }

  const [clientCount] = await db
    .select({ count: count() })
    .from(clients)
    .where(eq(clients.therapistId, therapist.id));

  const [pendingInvoiceCount] = await db
    .select({ count: count() })
    .from(invoices)
    .where(
      and(
        eq(invoices.therapistId, therapist.id),
        eq(invoices.status, "sent")
      )
    );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [upcomingAppointmentCount] = await db
    .select({ count: count() })
    .from(appointments)
    .where(
      and(
        eq(appointments.therapistId, therapist.id),
        gte(appointments.scheduledAt, today),
        eq(appointments.status, "scheduled")
      )
    );

  const recentClients = await db.query.clients.findMany({
    where: eq(clients.therapistId, therapist.id),
    orderBy: desc(clients.createdAt),
    limit: 5,
    with: {
      consents: true,
    },
  });

  return (
    <PageShell className="space-y-8">
      <PageHeader title="Dashboard" />

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Clients</CardDescription>
            <CardTitle className="text-3xl">{clientCount?.count ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/therapist/clients">
              <Button variant="ghost" className={cn(touchActionClassName, "justify-start px-0")}>
                View all &rarr;
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unpaid Invoices</CardDescription>
            <CardTitle className="text-3xl">{pendingInvoiceCount?.count ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/therapist/invoices">
              <Button variant="ghost" className={cn(touchActionClassName, "justify-start px-0")}>
                View all &rarr;
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2 md:col-span-1">
          <CardHeader className="pb-2">
            <CardDescription>Upcoming Appointments</CardDescription>
            <CardTitle className="text-3xl">{upcomingAppointmentCount?.count ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/therapist/calendar">
              <Button variant="ghost" className={cn(touchActionClassName, "justify-start px-0")}>
                View calendar &rarr;
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {!therapist.stripeOnboardingComplete && (
        <Card className="border-warning">
          <CardHeader>
            <CardTitle className="text-warning">Complete payment setup</CardTitle>
            <CardDescription>
              Set up payments to start receiving money from clients.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/therapist/settings#stripe">
              <Button className={touchActionClassName}>Set up payments &rarr;</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Clients</CardTitle>
          <CardDescription>
            Your newest clients and whether their intake forms are done
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentClients.length === 0 ? (
            <div className="py-8 text-center">
              <p className="mb-4 text-muted-foreground">No clients yet</p>
              <Link href="/therapist/clients">
                <Button className={touchActionClassName}>Add your first client</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentClients.map((client) => {
                const signedCount = client.consents.filter(
                  (c) => c.status === "signed"
                ).length;
                const totalRequired = REQUIRED_CONSENT_TEMPLATES.length;
                const allSigned = signedCount >= totalRequired;

                return (
                  <div
                    key={client.id}
                    className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {client.firstName} {client.lastName}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {client.email}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <Badge variant={allSigned ? "success" : "warning"}>
                        {allSigned
                          ? "Forms complete"
                          : `${signedCount}/${totalRequired} signed`}
                      </Badge>
                      <Link href={`/therapist/clients/${client.id}`}>
                        <Button variant="outline" className={touchActionClassName}>
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
