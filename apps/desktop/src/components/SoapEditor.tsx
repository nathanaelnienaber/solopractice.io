import type { SoapNote } from "@solopractice/shared/desktop";

interface SoapEditorProps {
  soapNote: Partial<SoapNote>;
  onChange: (note: Partial<SoapNote>) => void;
  onSave: () => void;
  onCancel: () => void;
  /** Optional heading context, shown above the editor when provided. */
  clientName?: string;
  /** Shown when fields are empty so the therapist knows why. */
  emptyHint?: string;
}

function noteLooksEmpty(note: Partial<SoapNote>): boolean {
  return ![note.subjective, note.objective, note.assessment, note.plan].some(
    (s) => (s || "").trim().length > 0
  );
}

export function SoapEditor({
  soapNote,
  onChange,
  onSave,
  onCancel,
  clientName,
  emptyHint,
}: SoapEditorProps) {
  const empty = noteLooksEmpty(soapNote);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">SOAP Note</h2>
          {clientName && (
            <p className="text-sm text-muted-foreground">{clientName}</p>
          )}
        </div>
        {soapNote.isDraft && (
          <span className="text-xs px-2 py-1 rounded-full bg-warning/10 text-warning">
            {empty ? "Draft — waiting or write by hand" : "Draft"}
          </span>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {empty
          ? "Write your note here, or wait for a local draft if speech-to-text is running. Saved on this computer only."
          : "Review and edit the draft. All changes are saved on this computer only."}
      </p>

      {empty && emptyHint && (
        <p className="text-sm text-muted-foreground border border-border rounded-lg px-3 py-2 bg-muted/40">
          {emptyHint}
        </p>
      )}

      <div className="space-y-4">
        <SoapSection
          label="S - Subjective"
          value={soapNote.subjective || ""}
          onChange={(value) => onChange({ ...soapNote, subjective: value })}
          placeholder="Client's reported symptoms, feelings, and concerns..."
        />

        <SoapSection
          label="O - Objective"
          value={soapNote.objective || ""}
          onChange={(value) => onChange({ ...soapNote, objective: value })}
          placeholder="Observable facts, mental status exam, appearance..."
        />

        <SoapSection
          label="A - Assessment"
          value={soapNote.assessment || ""}
          onChange={(value) => onChange({ ...soapNote, assessment: value })}
          placeholder="Clinical assessment, diagnosis considerations..."
        />

        <SoapSection
          label="P - Plan"
          value={soapNote.plan || ""}
          onChange={(value) => onChange({ ...soapNote, plan: value })}
          placeholder="Treatment plan, next steps, homework..."
        />
      </div>

      <div className="flex gap-3 pt-4 border-t border-border">
        <button
          onClick={onSave}
          className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          Save Note
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-border rounded-lg font-medium hover:bg-accent transition-colors"
        >
          Cancel
        </button>
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p>
          <strong>Security:</strong> This note is saved only on your local device.
          It is never uploaded to the cloud.
        </p>
        <p>
          <strong>Superbill:</strong> Generate a superbill after saving to create
          a PDF with Dx and CPT codes.
        </p>
      </div>
    </div>
  );
}

function SoapSection({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
      />
    </div>
  );
}
