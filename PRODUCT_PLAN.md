# solopractice — Product Plan

**Status:** Draft for Nathanael · 2026-09-18  
**Working name:** solopractice  
**Primary user:** Solo licensed mental health counselor (LMHC) — first customer: Nathanael’s wife  
**Builders:** Local-first clinical core; web for intake, reminders, billing

---

## 1. Problem

Solo therapists lose hours to intake paperwork, session notes, superbills, reminders, and getting paid. Existing EHR / practice tools are heavy, expensive, and cloud-first. She needs something that:

1. Gets a new client onboarded with the right consents  
2. Reminds them of sessions  
3. Captures the session (audio → notes) without fighting an EHR  
4. Produces a superbill and gets paid  

…without the builders hosting a clinical data lake.

---

## 2. Product principles

1. **Desktop is the only home for clinical data.** SOAP, Dx, CPT, audio, and transcripts never sync to the webapp.  
2. **Web is for client-facing workflows** (intake, e-sign, schedule/reminders, pay).  
3. **Clinical features are free.** Monetize only on **successful payments** via a **1% platform fee atop Stripe**. **Closed-source** (not open-source / not a public vibe-codeable repo).  
4. **No auto-send of irreversible clinical/billing artifacts** without therapist confirmation (especially email with PHI-ish content).  
5. **Recording requires explicit consent** on file before “Record” is enabled.  
6. **Email provider TBD** — do not block MVP architecture on it; abstract behind `EmailProvider`.
7. **Free local STT + LLM only** for transcript/SOAP — no cloud transcription of clinical audio. Jobs run **in the background** (delayed OK); UI stays responsive.

---

## 3. Users & roles

| Role | Where they work | What they do |
|------|-----------------|--------------|
| Therapist | Desktop app + Web admin | Clients, sessions, notes, record, SOAP, superbills, send bills, configure fees/templates |
| Client | Web (magic link) | Sign consents, view upcoming session, pay invoice |
| Platform (you) | Stripe Connect | Application fee on charges; no access to clinical notes |

---

## 4. System shape

```
┌─────────────────────────────┐     ┌──────────────────────────────┐
│  Desktop (local)            │     │  Web                          │
│  - Encrypted SQLite         │◀───▶│  - Intake + e-sign consents   │
│  - Audio / Whisper STT      │sync │  - Schedule + Twilio SMS      │
│  - SOAP (local LLM)         │light│  - Invoices + Stripe Checkout │
│  - Superbill PDF            │     │  - Client pay (CC / ACH)      │
└─────────────────────────────┘     └──────────────────────────────┘
         │                                      │
         │ never uploads audio/notes by default │ EmailProvider (TBD)
         ▼                                      ▼
   Local disk only                    Consents, reminders, receipts
```

**Hard security boundary (non-negotiable):** The following **never leave the desktop / never sync to the webapp**:

- Session audio recordings  
- Transcripts  
- SOAP notes  
- Diagnosis codes (ICD)  
- CPT / procedure codes used in clinical documentation  
- Any derived clinical narrative  

Web may hold only **ops data**: client contact, consent completion flags (not clinical content), appointments, invoices/payment status. Link by opaque `client_id`.

**Superbill:** Generated **only on desktop** from local codes + fee schedule. Web invoices are amount/due-date/pay links — they must not embed Dx/CPT/SOAP. If a paid session needs a clinical superbill, that PDF stays a desktop artifact (email via her client, not uploaded to our web DB).

---

## 5. Feature map

### 5.1 Web — Therapist

- Create client / send intake invite  
- Auto-send **LMHC consent pack** (state + license template; start with her state only)  
- See consent completion status (ops flags only)
- Desktop consumes consent-complete flag → client selectable vs greyed out  
- Schedule next session  
- Trigger reminders (Twilio SMS; email when provider chosen)  
- Create / send bill (amount, session ref, due date)  
- Fee schedule + platform fee display (“client pays X; processor + platform fee”)

### 5.2 Web — Client

- Open secure magic link  
- E-sign required consents (blocked until complete)  
- View next appointment  
- Pay invoice (card or ACH)  
- Download receipt / paid invoice PDF  

### 5.3 Desktop — Therapist

- Clients list + search (greyed / Record blocked until required web consents signed)
- Local form library (PHI-capable forms): create/pick → print or native email → local store only  
- Past session notes (SOAP history)  
- Start session → **Record** (gated on recording consent)  
- Local transcription via **free** STT (e.g. whisper.cpp) — **queued / background**, may be delayed/slow; must not bog the UI during/after session  
- Draft SOAP via **free local LLM** (e.g. Ollama) — same: background job, short template-constrained draft → therapist edits → save  
- Session UX: Record → Save audio immediately → show “Transcribing…” / “Drafting SOAP…” without blocking charting  
- Generate **superbill PDF** (local)  
- “Attach / open in mail client” for superbill (MVP); optional send via EmailProvider later  
- Encrypted backup / export  

### 5.4 Platform money

- Stripe Connect: therapist = connected account; platform takes **application fee**  
- Client pays CC or ACH  
- **Platform fee (working):** **1% on top of Stripe** CC/ACH fees. Clinical free. Revisit if support/ops load appears. (Settled at 1% atop Stripe; closed-source, not open-source.)  
- Everything else free  

---

## 6. Consent pack (MVP content types)

Not legal advice — templates must be attorney-reviewed for her license + state.

Minimum set:

1. Informed consent (treatment, fees, cancellation)  
2. Notice of Privacy Practices  
3. Telehealth consent (if applicable)  
4. **Session recording consent** — collected at onboard with the LMHC pack; hard gate for desktop Record  
5. Limits of confidentiality / emergency  

Store: signed PDF, timestamp, IP/user-agent, form version hash.

---

## 7. MVP vs later

### MVP (ship first)

1. Desktop (**Windows first**): clients, sessions, record → local STT → editable SOAP → save  
2. Desktop: superbill PDF + open externally  
3. Web: invite client → e-sign consent pack (one state) → status sync flag to desktop  
4. Web: create invoice → Stripe Checkout (card; ACH if easy) → Connect payout to her  
5. Twilio SMS reminder for next session  

### Phase 2

- Email provider integration (reminders, magic links, receipts)  
- Richer scheduling calendar  
- Multi-state consent packs  
- Auto-attach superbill email with confirmation UI  
- ACH optimization, saved payment methods  
- Client portal history  

### Non-goals (v1)

- Multi-therapist group practice  
- Insurance claim submission (clearinghouse)  
- Telehealth video inside the app  
- Builders hosting audio/transcripts in the cloud  

---

## 8. Suggested stack (opinionated, changeable)

| Layer | Suggestion |
|-------|------------|
| Desktop | Tauri 2 or Electron + local encrypted SQLite |
| STT | Free local (whisper.cpp etc.) — **background queue**, low priority CPU/GPU |
| SOAP LLM | Free local (Ollama etc.) — **background**; never cloud with clinical audio/text |
| Web | Next.js (or similar) + Postgres for non-clinical ops data |
| Auth | Therapist: email magic link / password; Client: magic link only |
| Payments | Stripe Connect (Express or Standard — finalize in Connect plan) |
| SMS | Twilio |
| Email | **TBD** (interface now, pick later) |
| E-sign | Embedded signatures (PDF + audit trail); avoid inventing legal text |

---

## 9. Compliance posture (honest)

- **Hard line:** No SOAP, Dx, CPT, recordings, or transcripts on builders’ servers or the webapp DB. That keeps the clinical chart out of our hosted stack.  
- **Still true:** Web intake, SMS, email, and payments touch names, contact info, and billing amounts — health-*adjacent* ops data. That may still trigger vendor BAAs (Stripe/Twilio/email) depending on counsel’s read; it is **not** the same as hosting an EHR. Do not market “HIPAA-free” as a blanket claim.  
- Therapist remains responsible for clinical/legal practice requirements.  
- This plan is **not** legal advice.

---

## 10. Decisions

- [x] Platform fee: **1% atop Stripe**; closed-source  
- [x] **Email:** required for magic links / receipts (provider still TBD; abstract `EmailProvider`)  
- [x] **Ship OS order:** **Windows (PC) → Mac → Linux**  
- [x] **Consent copy:** ship **boilerplate drafts** first; Nathanael gets attorney review before real clients  
- [x] **Consent ↔ desktop UX:** therapist picks client from desktop dropdown; client is **greyed out / Record blocked** until web shows all required consents signed  
- [x] **Two form lanes:**  
  - **Web (ops, not clinical PHI):** standard LMHC onboard pack → e-sign → status flag to desktop  
  - **Desktop (may include PHI):** therapist creates or picks from local library → print or native email only → **store only on desktop**, never WebUI  
- [x] Email provider: **Resend**
- [x] v1 OS: **Windows only** (wife tests MVP)
- [x] Consents: boilerplate; **fake clients only** until counsel
- [x] Monetization: **1% only** (no monthly floor)
- [x] Nathanael: go/no-go only — Grok Bot / cloud agents own build  
- [x] Stripe Connect: **Express + 1% application fee** (confirmed)  
- [ ] Whisper model size vs quality on her PC  

---


## 10a. Stripe Connect — recommended default (for Nathanael to confirm)

**Recommendation:** Stripe Connect **Express** + **destination charges** (or Checkout with `application_fee_amount` = 1% of charge).

| Topic | Default |
|-------|---------|
| Connected account | **Express** — she onboards via Stripe-hosted KYC; you don’t build a full dashboard |
| Charge pattern | Platform creates Checkout/PaymentIntent; funds to her connected account; **1% application fee** to platform |
| Stripe processing fees | Paid from the charge (standard Connect behavior); show line: “Card processing (Stripe) + 1% solopractice fee” |
| Refunds | Therapist initiates; **application fee refunded proportionally**; she bears Stripe fee loss unless you absorb later |
| Chargebacks | Connected account (her practice) is primary — document in her onboarding |
| ACH | Enable once cards work; same 1% application fee |
| Payouts | Stripe Express dashboard / automatic payouts to her bank |

Rationale: least builder surface, standard for “solo gets paid, platform takes a cut,” matches closed-source freemium tool not a bank.

**Confirmed 2026-09-18:** Express + 1% application fee.

## 11. Success metrics (first 90 days with one practice)

- Time from “session ended” → signed SOAP < 10 minutes median  
- Consents complete before first session ≥ 95%  
- Invoice → paid < 48h for card payers  
- Zero clinical audio, transcripts, SOAP, Dx, or CPT uploaded to builders’ servers / webapp  

---

## 12. Next engineering steps

1. Confirm Connect default (§10a) + pick EmailProvider  
2. Clickable IA / screens (Designer)  
3. Scaffold monorepo: `apps/desktop`, `apps/web`, `packages/shared`  
4. Spike: local record → whisper → SOAP prompt on her target machine  
5. Spike: Stripe Connect test charge with application fee  


## 13. Build authority (2026-09-18)

Nathanael authorized autonomous build without day-to-day input:
- Resend for email
- Windows desktop MVP first
- Boilerplate consents + fake/test clients only (no live patients)
- 1% Connect Express fee only
- He is not hands-on; builders proceed on go/no-go milestones only
