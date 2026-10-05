import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionTherapist } from "@/lib/auth";
import { db, clients, consents, invoices, appointments } from "@/db";
import { eq, and, desc, gte, count } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { REQUIRED_CONSENT_TEMPLATES } from "@/lib/consent-templates";

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
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
      </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Clients</CardDescription>
              <CardTitle className="text-3xl">{clientCount?.count ?? 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/therapist/clients">
                <Button variant="ghost" size="sm">View all &rarr;</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Invoices</CardDescription>
              <CardTitle className="text-3xl">{pendingInvoiceCount?.count ?? 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/therapist/invoices">
                <Button variant="ghost" size="sm">View all &rarr;</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Upcoming Appointments</CardDescription>
              <CardTitle className="text-3xl">{upcomingAppointmentCount?.count ?? 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/therapist/calendar">
                <Button variant="ghost" size="sm">View calendar &rarr;</Button>
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
                <Button>Set up payments &rarr;</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Recent Clients</CardTitle>
            <CardDescription>
              Quick view of your newest clients and their consent status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentClients.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No clients yet</p>
                <Link href="/therapist/clients">
                  <Button>Add your first client</Button>
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
                      className="py-3 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium">
                          {client.firstName} {client.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {client.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={allSigned ? "success" : "warning"}>
                          {allSigned
                            ? "Consents complete"
                            : `${signedCount}/${totalRequired} signed`}
                        </Badge>
                        <Link href={`/therapist/clients/${client.id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
    </main>
  );
}
