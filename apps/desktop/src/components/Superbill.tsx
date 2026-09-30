import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

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
  const [view, setView] = useState<"form" | "history">("form");
  const [clients, setClients] = useState<Client[]>([]);
  const [superbills, setSuperbills] = useState<SuperbillRecord[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generatedPath, setGeneratedPath] = useState<string | null>(null);

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
    loadTherapistInfo();
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

  async function loadTherapistInfo() {
    try {
      const settings = await invoke<Record<string, string>>("load_settings");
      // Load from settings if available
      if (settings) {
        setTherapistInfo((prev) => ({
          ...prev,
          practiceName: settings.practiceName || prev.practiceName,
          therapistName: settings.therapistName || prev.therapistName,
        }));
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
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

    setGenerating(true);
    setGeneratedPath(null);

    try {
      const path = await invoke<string>("generate_superbill", {
        input: {
          sessionId: null,
          clientName: `${client.firstName} ${client.lastName}`,
          clientDob: clientDob || null,
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

  const totalCents = selectedServices.reduce(
    (sum, s) => sum + s.chargeCents * s.units,
    0
  );

  return (
    <div className="h-full flex flex-col">
      <header className="p-4 border-b border-[var(--border)] flex items-center justify-between">
        <h1 className="text-xl font-semibold">Superbill</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setView("form")}
            className={`px-3 py-1 rounded-lg text-sm ${
              view === "form"
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "bg-[var(--muted)] text-[var(--foreground)]"
            }`}
          >
            Create New
          </button>
          <button
            onClick={() => setView("history")}
            className={`px-3 py-1 rounded-lg text-sm ${
              view === "history"
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "bg-[var(--muted)] text-[var(--foreground)]"
            }`}
          >
            History ({superbills.length})
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {view === "form" ? (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Success message */}
            {generatedPath && (
              <div className="p-4 bg-[var(--success)]/10 border border-[var(--success)]/20 rounded-lg">
                <p className="text-[var(--success)] font-medium mb-2">
                  Superbill generated successfully!
                </p>
                <button
                  onClick={() => openPdf(generatedPath)}
                  className="px-4 py-2 bg-[var(--success)] text-white rounded-lg text-sm"
                >
                  Open PDF
                </button>
              </div>
            )}

            {/* Client Selection */}
            <section className="space-y-3">
              <h2 className="font-medium">Client Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[var(--muted-foreground)] mb-1">
                    Client
                  </label>
                  <select
                    value={selectedClient}
                    onChange={(e) => setSelectedClient(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)]"
                  >
                    <option value="">Select client...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[var(--muted-foreground)] mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={clientDob}
                    onChange={(e) => setClientDob(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[var(--muted-foreground)] mb-1">
                    Address (optional)
                  </label>
                  <input
                    type="text"
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    placeholder="123 Main St, City, ST 12345"
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--muted-foreground)] mb-1">
                    Phone (optional)
                  </label>
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)]"
                  />
                </div>
              </div>
            </section>

            {/* Service Date */}
            <section className="space-y-3">
              <h2 className="font-medium">Service Date</h2>
              <input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)]"
              />
            </section>

            {/* Diagnosis Codes */}
            <section className="space-y-3">
              <h2 className="font-medium">Diagnosis Codes (ICD-10)</h2>
              {selectedDiagnoses.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedDiagnoses.map((dx, i) => (
                    <span
                      key={dx.code}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--primary)]/10 text-[var(--primary)] rounded-full text-sm"
                    >
                      <span className="font-medium">
                        {String.fromCharCode(65 + i)}.
                      </span>
                      {dx.code} - {dx.description}
                      <button
                        onClick={() => removeDiagnosis(dx.code)}
                        className="hover:text-[var(--destructive)]"
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
                  <button
                    key={dx.code}
                    onClick={() => addDiagnosis(dx)}
                    className="px-2 py-1 text-xs border border-[var(--border)] rounded hover:bg-[var(--muted)]"
                  >
                    {dx.code}
                  </button>
                ))}
              </div>
            </section>

            {/* Service Codes */}
            <section className="space-y-3">
              <h2 className="font-medium">Service Codes (CPT)</h2>
              {selectedServices.length > 0 && (
                <div className="space-y-2">
                  {selectedServices.map((svc, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 bg-[var(--muted)]/50 rounded-lg"
                    >
                      <span className="font-mono font-medium">{svc.cptCode}</span>
                      <span className="flex-1 text-sm">{svc.description}</span>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-[var(--muted-foreground)]">
                          Dx:
                        </label>
                        <input
                          type="text"
                          value={svc.diagnosisPointer}
                          onChange={(e) =>
                            updateService(i, { diagnosisPointer: e.target.value })
                          }
                          className="w-12 px-2 py-1 text-xs rounded border border-[var(--border)] bg-[var(--background)]"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-[var(--muted-foreground)]">
                          Units:
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={svc.units}
                          onChange={(e) =>
                            updateService(i, { units: parseInt(e.target.value) || 1 })
                          }
                          className="w-16 px-2 py-1 text-xs rounded border border-[var(--border)] bg-[var(--background)]"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-[var(--muted-foreground)]">
                          $
                        </label>
                        <input
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
                          className="w-20 px-2 py-1 text-xs rounded border border-[var(--border)] bg-[var(--background)]"
                        />
                      </div>
                      <button
                        onClick={() => removeService(i)}
                        className="text-[var(--destructive)] hover:opacity-70"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {COMMON_CPT_CODES.map((cpt) => (
                  <button
                    key={cpt.code}
                    onClick={() => addService(cpt)}
                    className="px-2 py-1 text-xs border border-[var(--border)] rounded hover:bg-[var(--muted)]"
                  >
                    {cpt.code} - {cpt.description}
                  </button>
                ))}
              </div>
            </section>

            {/* Therapist Info */}
            <section className="space-y-3">
              <h2 className="font-medium">Therapist / Practice Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[var(--muted-foreground)] mb-1">
                    Practice Name
                  </label>
                  <input
                    type="text"
                    value={therapistInfo.practiceName}
                    onChange={(e) =>
                      setTherapistInfo({ ...therapistInfo, practiceName: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--muted-foreground)] mb-1">
                    Therapist Name
                  </label>
                  <input
                    type="text"
                    value={therapistInfo.therapistName}
                    onChange={(e) =>
                      setTherapistInfo({ ...therapistInfo, therapistName: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-[var(--muted-foreground)] mb-1">
                    Credentials
                  </label>
                  <input
                    type="text"
                    value={therapistInfo.credentials}
                    onChange={(e) =>
                      setTherapistInfo({ ...therapistInfo, credentials: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--muted-foreground)] mb-1">
                    NPI Number
                  </label>
                  <input
                    type="text"
                    value={therapistInfo.npiNumber || ""}
                    onChange={(e) =>
                      setTherapistInfo({ ...therapistInfo, npiNumber: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--muted-foreground)] mb-1">
                    Tax ID
                  </label>
                  <input
                    type="text"
                    value={therapistInfo.taxId || ""}
                    onChange={(e) =>
                      setTherapistInfo({ ...therapistInfo, taxId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-[var(--muted-foreground)] mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={therapistInfo.addressStreet}
                  onChange={(e) =>
                    setTherapistInfo({ ...therapistInfo, addressStreet: e.target.value })
                  }
                  placeholder="Street address"
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)]"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <input
                    type="text"
                    value={therapistInfo.addressCity}
                    onChange={(e) =>
                      setTherapistInfo({ ...therapistInfo, addressCity: e.target.value })
                    }
                    placeholder="City"
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)]"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={therapistInfo.addressState}
                    onChange={(e) =>
                      setTherapistInfo({ ...therapistInfo, addressState: e.target.value })
                    }
                    placeholder="State"
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)]"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={therapistInfo.addressZip}
                    onChange={(e) =>
                      setTherapistInfo({ ...therapistInfo, addressZip: e.target.value })
                    }
                    placeholder="ZIP"
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-[var(--muted-foreground)] mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={therapistInfo.phone || ""}
                  onChange={(e) =>
                    setTherapistInfo({ ...therapistInfo, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)]"
                />
              </div>
            </section>

            {/* Total and Generate */}
            <section className="p-4 bg-[var(--muted)]/50 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-[var(--muted-foreground)]">Total: </span>
                <span className="text-2xl font-bold">
                  ${(totalCents / 100).toFixed(2)}
                </span>
              </div>
              <button
                onClick={generateSuperbill}
                disabled={generating}
                className="px-6 py-3 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg font-medium disabled:opacity-50"
              >
                {generating ? "Generating..." : "Generate Superbill PDF"}
              </button>
            </section>
          </div>
        ) : (
          /* History View */
          <div className="max-w-3xl mx-auto">
            {superbills.length === 0 ? (
              <div className="text-center py-12 text-[var(--muted-foreground)]">
                No superbills generated yet
              </div>
            ) : (
              <div className="space-y-3">
                {superbills.map((sb) => (
                  <div
                    key={sb.id}
                    className="flex items-center justify-between p-4 border border-[var(--border)] rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{sb.clientName}</p>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {sb.serviceDate} • ${(sb.totalAmountCents / 100).toFixed(2)}
                      </p>
                    </div>
                    <button
                      onClick={() => openPdf(sb.pdfPath)}
                      className="px-4 py-2 bg-[var(--muted)] text-[var(--foreground)] rounded-lg text-sm hover:bg-[var(--accent)]"
                    >
                      Open PDF
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
