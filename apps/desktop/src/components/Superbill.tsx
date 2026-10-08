import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ActionRow,
  Banner,
  Button,
  EmptyState,
  Field,
  FormGrid,
  Input,
  LoadingState,
  PageBody,
  PageHeader,
  PageSection,
  PageShell,
  Panel,
  Select,
} from "./ui";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
}

interface DiagnosisCode {
  code: string;
  description: string;
}

interface ServiceCode {
  cptCode: string;
  description: string;
  units: number;
  chargeCents: number;
  diagnosisPointer: string;
}

interface TherapistInfo {
  practiceName: string;
  therapistName: string;
  credentials: string;
  npiNumber?: string;
  taxId?: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  phone?: string;
}

interface SuperbillRecord {
  id: string;
  clientName: string;
  serviceDate: string;
  totalAmountCents: number;
  pdfPath: string;
  createdAt: string;
}

interface PendingRequest {
  invoiceId: string;
  clientId: string;
  clientFirstName: string;
  clientLastName: string;
  clientEmail: string;
  amountCents: number;
  description: string;
  paidAt: string | null;
  superbillRequestStatus: string;
  superbillRequestedAt: string | null;
}

const COMMON_DIAGNOSIS_CODES: DiagnosisCode[] = [
  { code: "F41.1", description: "Generalized Anxiety Disorder" },
  { code: "F41.0", description: "Panic Disorder" },
  { code: "F32.0", description: "Major Depressive Disorder, single episode, mild" },
  { code: "F32.1", description: "Major Depressive Disorder, single episode, moderate" },
  { code: "F32.2", description: "Major Depressive Disorder, single episode, severe" },
  { code: "F33.0", description: "Major Depressive Disorder, recurrent, mild" },
  { code: "F33.1", description: "Major Depressive Disorder, recurrent, moderate" },
  { code: "F43.10", description: "Post-Traumatic Stress Disorder" },
  { code: "F43.21", description: "Adjustment Disorder with Depressed Mood" },
  { code: "F43.22", description: "Adjustment Disorder with Anxiety" },
  { code: "F43.23", description: "Adjustment Disorder with Mixed Anxiety and Depressed Mood" },
  { code: "F40.10", description: "Social Anxiety Disorder" },
  { code: "F42.2", description: "Obsessive-Compulsive Disorder" },
  { code: "F60.3", description: "Borderline Personality Disorder" },
  { code: "F90.0", description: "ADHD, predominantly inattentive" },
  { code: "F90.1", description: "ADHD, predominantly hyperactive" },
  { code: "F90.2", description: "ADHD, combined type" },
];

const COMMON_CPT_CODES = [
  { code: "90832", description: "Psychotherapy, 30 min", defaultCharge: 8000 },
  { code: "90834", description: "Psychotherapy, 45 min", defaultCharge: 12000 },
  { code: "90837", description: "Psychotherapy, 60 min", defaultCharge: 16000 },
  { code: "90847", description: "Family therapy with patient", defaultCharge: 15000 },
  { code: "90846", description: "Family therapy without patient", defaultCharge: 15000 },
  { code: "90853", description: "Group psychotherapy", defaultCharge: 6000 },
  { code: "90791", description: "Psychiatric diagnostic evaluation", defaultCharge: 20000 },
  { code: "96130", description: "Psychological testing, first hour", defaultCharge: 20000 },
  { code: "96131", description: "Psychological testing, additional 30 min", defaultCharge: 10000 },
];

export function Superbill() {
  const [view, setView] = useState<"form" | "pending" | "history">("form");
  const [clients, setClients] = useState<Client[]>([]);
  const [superbills, setSuperbills] = useState<SuperbillRecord[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [pendingError, setPendingError] = useState("");
  const [pendingLoading, setPendingLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedPath, setGeneratedPath] = useState<string | null>(null);
  const [fulfillingInvoiceId, setFulfillingInvoiceId] = useState<string | null>(
    null
  );
  const [clientEmailForShare, setClientEmailForShare] = useState("");
  const [markingSent, setMarkingSent] = useState(false);

  // Form state
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [clientDob, setClientDob] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<DiagnosisCode[]>([]);
  const [selectedServices, setSelectedServices] = useState<ServiceCode[]>([]);
  const [therapistInfo, setTherapistInfo] = useState<TherapistInfo>({
    practiceName: "",
    therapistName: "",
    credentials: "LMHC",
    addressStreet: "",
    addressCity: "",
    addressState: "",
    addressZip: "",
  });

  useEffect(() => {
    loadClients();
    loadSuperbills();
    loadPending();
  }, []);

  async function loadClients() {
    try {
      const result = await invoke<Client[]>("get_clients");
      setClients(result);
    } catch (error) {
      console.error("Failed to load clients:", error);
    }
  }

  async function loadSuperbills() {
    try {
      const result = await invoke<SuperbillRecord[]>("get_superbills");
      setSuperbills(result);
    } catch (error) {
      console.error("Failed to load superbills:", error);
    }
  }

  async function loadPending() {
    setPendingLoading(true);
    setPendingError("");
    try {
      const result = await invoke<PendingRequest[]>("get_pending_superbill_requests");
      setPending(result);
    } catch (error) {
      console.error("Failed to load pending requests:", error);
      setPendingError(
        error instanceof Error ? error.message : String(error)
      );
      setPending([]);
    } finally {
      setPendingLoading(false);
    }
  }

  function fulfillRequest(req: PendingRequest) {
    setSelectedClient(req.clientId);
    setClientEmailForShare(req.clientEmail);
    setFulfillingInvoiceId(req.invoiceId);
    if (req.paidAt) {
      const d = new Date(req.paidAt);
      if (!Number.isNaN(d.getTime())) {
        setServiceDate(d.toISOString().split("T")[0]!);
      }
    }
    const cpt = COMMON_CPT_CODES[2]!; // 90837 suggestion; therapist can change
    setSelectedServices([
      {
        cptCode: cpt.code,
        description: cpt.description,
        units: 1,
        chargeCents: req.amountCents,
        diagnosisPointer: "A",
      },
    ]);
    setView("form");
  }

  function addDiagnosis(dx: DiagnosisCode) {
    if (!selectedDiagnoses.find((d) => d.code === dx.code)) {
      setSelectedDiagnoses([...selectedDiagnoses, dx]);
    }
  }

  function removeDiagnosis(code: string) {
    setSelectedDiagnoses(selectedDiagnoses.filter((d) => d.code !== code));
  }

  function addService(cpt: (typeof COMMON_CPT_CODES)[0]) {
    const pointer = selectedDiagnoses
      .map((_, i) => String.fromCharCode(65 + i))
      .join(",");
    setSelectedServices([
      ...selectedServices,
      {
        cptCode: cpt.code,
        description: cpt.description,
        units: 1,
        chargeCents: cpt.defaultCharge,
        diagnosisPointer: pointer || "A",
      },
    ]);
  }

  function updateService(index: number, updates: Partial<ServiceCode>) {
    setSelectedServices(
      selectedServices.map((s, i) => (i === index ? { ...s, ...updates } : s))
    );
  }

  function removeService(index: number) {
    setSelectedServices(selectedServices.filter((_, i) => i !== index));
  }

  async function generateSuperbill() {
    const client = clients.find((c) => c.id === selectedClient);
    if (!client) {
      alert("Please select a client");
      return;
    }
    if (!clientDob.trim()) {
      alert("Client date of birth is required");
      return;
    }
    if (selectedDiagnoses.length === 0) {
      alert("Please add at least one diagnosis code");
      return;
    }
    if (selectedServices.length === 0) {
      alert("Please add at least one service code");
      return;
    }
    if (!therapistInfo.practiceName || !therapistInfo.therapistName) {
      alert("Please fill in therapist information");
      return;
    }
    if (!therapistInfo.credentials.trim()) {
      alert("Credentials are required");
      return;
    }
    if (
      !therapistInfo.addressStreet.trim() ||
      !therapistInfo.addressCity.trim() ||
      !therapistInfo.addressState.trim() ||
      !therapistInfo.addressZip.trim()
    ) {
      alert("Provider street, city, state, and ZIP are required");
      return;
    }

    setGenerating(true);
    setGeneratedPath(null);

    try {
      const path = await invoke<string>("generate_superbill", {
        input: {
          sessionId: null,
          webInvoiceId: fulfillingInvoiceId,
          clientId: selectedClient,
          clientName: `${client.firstName} ${client.lastName}`,
          clientDob: clientDob,
          clientAddress: clientAddress || null,
          clientPhone: clientPhone || null,
          serviceDate: new Date(serviceDate ?? new Date().toISOString().split("T")[0]!).toLocaleDateString("en-US"),
          diagnosisCodes: selectedDiagnoses,
          serviceCodes: selectedServices,
          therapistInfo,
        },
      });

      setGeneratedPath(path);
      loadSuperbills();
    } catch (error) {
      console.error("Failed to generate superbill:", error);
      alert("Failed to generate superbill: " + error);
    } finally {
      setGenerating(false);
    }
  }

  async function openPdf(path: string) {
    try {
      await invoke("open_superbill_pdf", { path });
    } catch (error) {
      console.error("Failed to open PDF:", error);
      alert("Failed to open PDF: " + error);
    }
  }

  function openLocalMailShare() {
    const client = clients.find((c) => c.id === selectedClient);
    const to = encodeURIComponent(clientEmailForShare || "");
    const subject = encodeURIComponent("Your superbill");
    const body = encodeURIComponent(
      `Hi${client ? ` ${client.firstName}` : ""},\n\nYour superbill PDF is attached from your therapist's computer (not uploaded to SoloPractice).\n\nPlease attach the PDF file from your Downloads or the app data folder before sending.\n`
    );
    window.open(`mailto:${to}?subject=${subject}&body=${body}`, "_blank");
  }

  async function markRequestSent() {
    if (!fulfillingInvoiceId) {
      alert("No pending request linked — open one from Pending requests first.");
      return;
    }
    setMarkingSent(true);
    try {
      await invoke("mark_superbill_request_sent", {
        invoiceId: fulfillingInvoiceId,
      });
      setFulfillingInvoiceId(null);
      loadPending();
      alert("Marked as sent. The client pay page will show Superbill sent.");
    } catch (error) {
      alert("Couldn't mark sent: " + error);
    } finally {
      setMarkingSent(false);
    }
  }

  const totalCents = selectedServices.reduce(
    (sum, s) => sum + s.chargeCents * s.units,
    0
  );

  return (
    <PageShell>
      <PageHeader
        title="Superbill"
        actions={
          <ActionRow>
            <Button
              size="sm"
              variant={view === "form" ? "primary" : "secondary"}
              onClick={() => setView("form")}
            >
              Create new
            </Button>
            <Button
              size="sm"
              variant={view === "pending" ? "primary" : "secondary"}
              onClick={() => {
                setView("pending");
                loadPending();
              }}
            >
              Pending ({pending.length})
            </Button>
            <Button
              size="sm"
              variant={view === "history" ? "primary" : "secondary"}
              onClick={() => setView("history")}
            >
              History ({superbills.length})
            </Button>
          </ActionRow>
        }
      />

      <PageBody narrow="lg">
        {view === "form" ? (
          <div className="space-y-6">
            {generatedPath && (
              <Banner tone="success" title="Superbill generated — saved on this computer only.">
                <ActionRow>
                  <Button size="sm" onClick={() => openPdf(generatedPath)}>
                    Open PDF
                  </Button>
                  <Button size="sm" variant="secondary" onClick={openLocalMailShare}>
                    Open mail client
                  </Button>
                  {fulfillingInvoiceId && (
                    <Button
                      size="sm"
                      onClick={markRequestSent}
                      loading={markingSent}
                    >
                      {markingSent ? "Marking…" : "Mark sent"}
                    </Button>
                  )}
                </ActionRow>
                <p className="text-xs text-muted-foreground">
                  Attach the PDF yourself in your mail app. SoloPractice never
                  emails or stores the superbill PDF.
                </p>
              </Banner>
            )}

            {fulfillingInvoiceId && !generatedPath && (
              <Banner tone="info">
                Fulfilling request for invoice{" "}
                <span className="font-mono text-xs">{fulfillingInvoiceId.slice(0, 8)}…</span>
                . Enter Dx/CPT and DOB, generate PDF, share locally, then Mark sent.
              </Banner>
            )}

            <PageSection title="Client information">
              <FormGrid cols={2}>
                <Field label="Client" htmlFor="superbill-client">
                  <Select
                    id="superbill-client"
                    value={selectedClient}
                    onChange={(e) => setSelectedClient(e.target.value)}
                  >
                    <option value="">Select client…</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Date of Birth (required)" htmlFor="superbill-dob">
                  <Input
                    id="superbill-dob"
                    type="date"
                    value={clientDob}
                    onChange={(e) => setClientDob(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Address (optional)" htmlFor="superbill-address">
                  <Input
                    id="superbill-address"
                    type="text"
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    placeholder="123 Main St, City, ST 12345"
                  />
                </Field>
                <Field label="Phone (optional)" htmlFor="superbill-phone">
                  <Input
                    id="superbill-phone"
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </Field>
              </FormGrid>
            </PageSection>

            <PageSection title="Service date">
              <Field htmlFor="superbill-service-date">
                <Input
                  id="superbill-service-date"
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  className="max-w-xs"
                />
              </Field>
            </PageSection>

            <PageSection title="Diagnosis codes (ICD-10)">
              {selectedDiagnoses.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedDiagnoses.map((dx, i) => (
                    <span
                      key={dx.code}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-lg text-sm border border-primary/20"
                    >
                      <span className="font-medium">
                        {String.fromCharCode(65 + i)}.
                      </span>
                      {dx.code} - {dx.description}
                      <button
                        type="button"
                        onClick={() => removeDiagnosis(dx.code)}
                        className="hover:text-destructive"
                        aria-label={`Remove ${dx.code}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {COMMON_DIAGNOSIS_CODES.filter(
                  (dx) => !selectedDiagnoses.find((d) => d.code === dx.code)
                ).map((dx) => (
                  <Button
                    key={dx.code}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addDiagnosis(dx)}
                    className="text-xs"
                  >
                    {dx.code}
                  </Button>
                ))}
              </div>
            </PageSection>

            <PageSection title="Service codes (CPT)">
              {selectedServices.length > 0 && (
                <div className="space-y-2">
                  {selectedServices.map((svc, i) => (
                    <Panel
                      key={i}
                      className="flex flex-wrap items-center gap-3 bg-muted/40"
                    >
                      <span className="font-mono font-medium">{svc.cptCode}</span>
                      <span className="flex-1 text-sm min-w-[8rem]">{svc.description}</span>
                      <Field
                        label="Dx"
                        orientation="horizontal"
                        className="items-center"
                      >
                        <Input
                          compact
                          type="text"
                          value={svc.diagnosisPointer}
                          onChange={(e) =>
                            updateService(i, { diagnosisPointer: e.target.value })
                          }
                          className="w-12"
                        />
                      </Field>
                      <Field
                        label="Units"
                        orientation="horizontal"
                        className="items-center"
                      >
                        <Input
                          compact
                          type="number"
                          min="1"
                          value={svc.units}
                          onChange={(e) =>
                            updateService(i, { units: parseInt(e.target.value) || 1 })
                          }
                          className="w-16"
                        />
                      </Field>
                      <Field
                        label="$"
                        orientation="horizontal"
                        className="items-center"
                      >
                        <Input
                          compact
                          type="number"
                          min="0"
                          step="0.01"
                          value={(svc.chargeCents / 100).toFixed(2)}
                          onChange={(e) =>
                            updateService(i, {
                              chargeCents: Math.round(
                                parseFloat(e.target.value) * 100
                              ),
                            })
                          }
                          className="w-20"
                        />
                      </Field>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeService(i)}
                        className="text-destructive"
                        aria-label="Remove service"
                      >
                        ×
                      </Button>
                    </Panel>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {COMMON_CPT_CODES.map((cpt) => (
                  <Button
                    key={cpt.code}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addService(cpt)}
                    className="text-xs"
                  >
                    {cpt.code} - {cpt.description}
                  </Button>
                ))}
              </div>
            </PageSection>

            <PageSection title="Therapist / practice information">
              <FormGrid cols={2}>
                <Field label="Practice Name" htmlFor="practice-name">
                  <Input
                    id="practice-name"
                    type="text"
                    value={therapistInfo.practiceName}
                    onChange={(e) =>
                      setTherapistInfo({ ...therapistInfo, practiceName: e.target.value })
                    }
                  />
                </Field>
                <Field label="Therapist Name" htmlFor="therapist-name">
                  <Input
                    id="therapist-name"
                    type="text"
                    value={therapistInfo.therapistName}
                    onChange={(e) =>
                      setTherapistInfo({ ...therapistInfo, therapistName: e.target.value })
                    }
                  />
                </Field>
              </FormGrid>
              <FormGrid cols={3}>
                <Field label="Credentials" htmlFor="credentials">
                  <Input
                    id="credentials"
                    type="text"
                    value={therapistInfo.credentials}
                    onChange={(e) =>
                      setTherapistInfo({ ...therapistInfo, credentials: e.target.value })
                    }
                  />
                </Field>
                <Field label="NPI Number" htmlFor="npi">
                  <Input
                    id="npi"
                    type="text"
                    value={therapistInfo.npiNumber || ""}
                    onChange={(e) =>
                      setTherapistInfo({ ...therapistInfo, npiNumber: e.target.value })
                    }
                  />
                </Field>
                <Field label="Tax ID" htmlFor="tax-id">
                  <Input
                    id="tax-id"
                    type="text"
                    value={therapistInfo.taxId || ""}
                    onChange={(e) =>
                      setTherapistInfo({ ...therapistInfo, taxId: e.target.value })
                    }
                  />
                </Field>
              </FormGrid>
              <Field
                label="Address (street, city, state, ZIP required)"
                htmlFor="addr-street"
              >
                <Input
                  id="addr-street"
                  type="text"
                  value={therapistInfo.addressStreet}
                  onChange={(e) =>
                    setTherapistInfo({ ...therapistInfo, addressStreet: e.target.value })
                  }
                  placeholder="Street address"
                />
              </Field>
              <FormGrid cols={3}>
                <Input
                  type="text"
                  value={therapistInfo.addressCity}
                  onChange={(e) =>
                    setTherapistInfo({ ...therapistInfo, addressCity: e.target.value })
                  }
                  placeholder="City"
                  aria-label="City"
                />
                <Input
                  type="text"
                  value={therapistInfo.addressState}
                  onChange={(e) =>
                    setTherapistInfo({ ...therapistInfo, addressState: e.target.value })
                  }
                  placeholder="State"
                  aria-label="State"
                />
                <Input
                  type="text"
                  value={therapistInfo.addressZip}
                  onChange={(e) =>
                    setTherapistInfo({ ...therapistInfo, addressZip: e.target.value })
                  }
                  placeholder="ZIP"
                  aria-label="ZIP"
                />
              </FormGrid>
              <Field label="Phone" htmlFor="therapist-phone">
                <Input
                  id="therapist-phone"
                  type="tel"
                  value={therapistInfo.phone || ""}
                  onChange={(e) =>
                    setTherapistInfo({ ...therapistInfo, phone: e.target.value })
                  }
                />
              </Field>
            </PageSection>

            <Panel className="flex flex-wrap items-center justify-between gap-4 bg-muted/50">
              <div>
                <span className="text-muted-foreground">Total: </span>
                <span className="text-2xl font-bold">
                  ${(totalCents / 100).toFixed(2)}
                </span>
              </div>
              <Button
                size="lg"
                onClick={generateSuperbill}
                loading={generating}
              >
                {generating ? "Generating…" : "Generate superbill PDF"}
              </Button>
            </Panel>
          </div>
        ) : view === "pending" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Clients who paid and requested a superbill. Generate the PDF on
              this computer, share it yourself (mail client / file), then mark
              sent. Clinical codes never sync to the web.
            </p>
            {pendingLoading ? (
              <LoadingState label="Loading pending requests…" />
            ) : pendingError ? (
              <EmptyState title="Could not load requests" description={pendingError} />
            ) : pending.length === 0 ? (
              <EmptyState
                title="No pending superbill requests"
                description="When a client requests a superbill after paying, it shows up here."
              />
            ) : (
              <div className="space-y-3">
                {pending.map((req) => (
                  <Panel
                    key={req.invoiceId}
                    className="flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {req.clientFirstName} {req.clientLastName}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {req.description} · $
                        {(req.amountCents / 100).toFixed(2)}
                        {req.superbillRequestedAt
                          ? ` · requested ${new Date(
                              req.superbillRequestedAt
                            ).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                    <Button
                      className="shrink-0"
                      size="sm"
                      onClick={() => fulfillRequest(req)}
                    >
                      Prepare
                    </Button>
                  </Panel>
                ))}
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={loadPending}>
              Refresh
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {superbills.length === 0 ? (
              <EmptyState
                title="No superbills generated yet"
                description="Create a new superbill PDF from the Create new tab."
              />
            ) : (
              superbills.map((sb) => (
                <Panel
                  key={sb.id}
                  className="flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-medium">{sb.clientName}</p>
                    <p className="text-sm text-muted-foreground">
                      {sb.serviceDate} • ${(sb.totalAmountCents / 100).toFixed(2)}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openPdf(sb.pdfPath)}
                  >
                    Open PDF
                  </Button>
                </Panel>
              ))
            )}
          </div>
        )}
      </PageBody>
    </PageShell>
  );
}
