# solopractice — Product Plan

**Status:** Active plan · 2026-10-03  
**Working name:** solopractice  
**Primary user:** Solo LMHC — first customer: Nathanael’s wife  
**How to use this file:** This is the single product plan. README and setup docs are how-to only; if they disagree with this file, this file wins. Update **§2 Current truth** in the same change that alters behavior. Build only against the **active gate** in §3.

**Nathanael’s role:** Go/no-go on gate exit. Not day-to-day task assignment.

---

## 1. North star

### Problem

Solo therapists lose hours to intake, session notes, superbills, reminders, and getting paid. Existing tools are heavy, expensive, and cloud-first. She needs to onboard a client with consents, remind them, capture the session (audio → notes), produce a superbill, and get paid — without us hosting a clinical data lake.

### Principles

1. **Desktop is the only home for clinical data.** SOAP, Dx, CPT, audio, transcripts, and superbills never sync to the web app.  
2. **Web is for client-facing ops:** intake, e-sign, schedule/reminders, pay.  
3. **Clinical features are free.** Monetize only on successful payments: **1% platform fee atop Stripe**. Closed-source.  
4. **No auto-send of clinical or billing artifacts** without therapist confirmation.  
5. **Recording requires recording consent** on file before Record is enabled.  
6. **Local STT + local LLM only** for transcript/SOAP (whisper.cpp + Ollama). No cloud transcription of clinical audio. Jobs may be slow; UI stays responsive.  
7. **Do not claim security we do not have.** Especially encryption at rest and “HIPAA-free.”

### Users

| Role | Where | Job |
|------|--------|-----|
| Therapist | Desktop + web admin | Clients, sessions, notes, record, SOAP, superbills, bills, settings |
| Client | Web links | Sign consents; pay invoice |
| Platform | Stripe Connect | 1% application fee; no clinical access |

### Monetization (settled)

- Stripe Connect **Express**, card Checkout, **1% application fee**  
- No monthly subscription  
- ACH later, same 1% when it exists  

### Non-goals (not in this product)

- Multi-therapist / group practice  
- Insurance claim submission (clearinghouse)  
- Telehealth video inside the app  
- Hosting audio, transcripts, or clinical notes on our servers  

### Success (after one live practice, 90 days)

- Session ended → signed SOAP &lt; 10 minutes median  
- Consents complete before first session ≥ 95%  
- Invoice → paid &lt; 48h for card payers  
- Zero clinical audio, transcripts, SOAP, Dx, CPT, or superbills on our servers  

These metrics apply **after Gate C**. Before that, use gate exit criteria only.

---

## 2. Current truth

*Reconcile this section whenever the repo’s behavior changes.*

### Architecture

```
┌─────────────────────────────┐     ┌──────────────────────────────┐
│  Desktop (Windows first)    │     │  Web                          │
│  - SQLite (not encrypted)   │◀───▶│  - Intake + e-sign consents   │
│  - Audio / whisper.cpp      │sync │  - Schedule + Twilio SMS      │
│  - SOAP (Ollama, localhost) │flags│  - Invoices + Stripe (card)   │
│  - Superbill PDF            │     │  - Resend (magic/invite/bill) │
└─────────────────────────────┘     └──────────────────────────────┘
         clinical chart stays here
```

Monorepo: `apps/desktop` (Tauri 2 + React + Rust), `apps/web` (Next.js + Drizzle + Neon), `packages/shared` (web vs desktop type entry points + clinical field blocklist).

### What works today (fake clients)

- Therapist magic link (Resend; HMAC-signed; 15 min; **not single-use**)  
- Create client → consent invite email → five draft forms e-signed → status sync to desktop via `X-Desktop-API-Key`  
- Record blocked until recording consent is signed  
- Record → local audio → whisper.cpp job (if binary + model configured) or manual transcript. Desktop **v0.1.3+**: mic acquire prefers Chrome-friendly constraints then falls back to `{ audio: true }`; Linux WebKitGTK enables media-stream + auto-allows UserMedia/DeviceInfo; AppImage bundles GStreamer (`bundleMediaFramework`) so Omarchy/Arch capture works. Setup mic test uses the same path and no longer soft-fails constraint errors as “permission denied.” **v0.1.4+**: Pause/Resume while recording; Stop opens a choice (go to SOAP notes / continue recording / save audio file / transcribe and auto-produce SOAP); SOAP screen polls `get_session_pipeline_status` so transcription/draft progress, readiness, and errors are visible (never a blank editor with no status).  
- Ollama SOAP draft on `127.0.0.1` → edit → save → SOAP PDF export (drafts refused)  
- Appointments list/create; Twilio SMS reminders (auto ~24h before via Vercel Cron + manual Send Reminder)  
- Invoice → Stripe Checkout (card) → Connect payout with 1% fee; webhook marks **Paid**. Therapist InvoiceCard shows **Overdue** when an unpaid sent/viewed invoice’s due date is before today (display-derived; not a cron). **Resend email** on Sent/Viewed/Overdue (same send route as first send). Draft invoices can **Edit** (amount/description/due date) or **Delete**; unpaid sent/viewed/overdue can **Delete** (confirm dialog) or **Resend**. Paid/refunded invoices cannot be deleted. Phone-first card: status badge top-right, stacked full-width actions.  
- Superbill screen in the desktop sidebar → `generate_superbill` writes a PDF under `app_data_dir/superbills/`, saves a local DB row, opens via OS viewer; history via `get_superbills`  
- **Pay → receipt → request superbill (ops):** Paid pay page shows receipt + **Request superbill**; invoice row holds `superbillRequestStatus` (`none` \| `requested` \| `sent`) only. Therapist sees badge + safe notify email. Desktop **Pending requests** → local PDF (DOB + letterhead + Dx/CPT required) → Open mail client / Open PDF → **Mark sent**. No cloud Dx/CPT/DOB/PDF. Plan: Project `docs/superbill-plan.md`.  
- Desktop runs on Windows (target) and Linux (dev); Mac not a target yet  

### Upcoming (ops only — does not change Gate B)

Superbill request flow is implemented per Project store `docs/superbill-plan.md`. Still later: Resend of superbill PDF (Gate D), real receipt *email*, Windows Gate A walkthrough. Does **not** advance Gate B attorney consents or encryption, and does **not** claim HIPAA-free.

### Known gaps / lies to avoid in copy

| Topic | Reality |
|-------|---------|
| Local DB encryption | Normal `rusqlite` file. `aes-gcm` unused. No SQLCipher. BitLocker is the only real at-rest protection today. |
| Web “flags only” | Web stores consent **template text**, signatures, IP, UA, version hash — not just flags. |
| Appointment `notes` | Free text in Postgres; **not** on the clinical field blocklist. Easy place to put session content by mistake. |
| Pay-page receipt | Webhook marks invoice paid; pay page shows on-page receipt (amount, date, practice, session label) + **Request superbill** (status on invoice only). No emailed receipt unless Resend actually sends one. Resend of superbill PDF still Gate D. |
| Invoice Overdue | Badge is computed at display time from due date for open invoices; DB row may still say `sent`/`viewed`. `viewed` is never written yet. |
| Invoice email | Same Resend path as consent. Subject is therapist-name + “Your invoice is ready” (no `$` in subject); plain text link CTA (not a solid “Pay” button); plain-text part included. From display name = therapist; Reply-To = therapist email. Send marks `sent` only after Resend returns a message id; Sent/Viewed/Overdue can **Resend email**. UI shows recipient + Resend id after send. Inbox placement still needs verified Resend domain + DMARC (see project doc). |
| Job retry | Failed jobs stay `failed`; processor only picks `pending`. |
| Desktop API key | Stored plaintext on therapist row (desktop must send raw value). |
| Consent legal status | Boilerplate drafts. Informed Consent for Treatment expanded to a US + territories + cross-border “one-stop” draft scaffold (`1.1.0-draft`); still **fake clients only** until Gate B attorney review. |
| Local PHI form library | `local_forms` table exists; no UI. |
| Backup | Not implemented. |
| Gate A Windows walkthrough | Not yet run on her PC. Checklist: [docs/GATE_A_WALKTHROUGH.md](docs/GATE_A_WALKTHROUGH.md). Whisper model still open. |

### Stack (locked unless a gate changes it)

| Layer | Choice |
|-------|--------|
| Desktop | Tauri 2 + React (Vite) + Rust + SQLite |
| STT | whisper.cpp CLI, background job |
| SOAP LLM | Ollama on localhost (`phi4-mini` if unset) |
| Web | Next.js App Router + Postgres (Neon) + Drizzle |
| Auth | Therapist magic link; client consent link (7 days on client row) |
| Payments | Stripe Connect Express, card, 1% fee |
| SMS | Twilio (auto ~24h before + manual send) |
| Email | Resend |
| Boundary | `@solopractice/shared/web` vs `/desktop`; API blocklist on write routes |

### Decisions log

- [x] 1% fee, closed-source, no monthly floor  
- [x] Resend  
- [x] Windows first → Mac → Linux (Linux already runs in dev)  
- [x] Boilerplate consents; fake clients until counsel  
- [x] Record gated on web recording consent  
- [x] Connect Express + 1% (2026-09-18)  
- [x] Build autonomy; Nathanael go/no-go on gates  
- [ ] Whisper model size vs quality on her PC  
- [ ] App-level encryption of local DB before any real session  

### Consent pack (draft; not legal advice)

1. Informed consent (expanded one-stop treatment draft: services, confidentiality exceptions, fees, telehealth/tech basics, US + cross-border jurisdiction/licensing acknowledgment, emergencies/limits of care, rights, signatures — still Gate A scaffold)  
2. Notice of Privacy Practices  
3. Telehealth consent  
4. Session recording consent (Record gate)  
5. Limits of confidentiality  

---

## 3. Release gates

Work **only** the active gate. Later items are parking lot, not parallel scope. Nathanael’s go/no-go is **gate exit**, not “keep building.”

### Gate A — Fake-client loop complete *(active)*

**Intent:** One therapist can run the full practice loop with **test data only**, on Windows, without marketing or docs claiming false security.

**Exit criteria (all required):**

1. Consent invite → e-sign all five → desktop sync shows ready; Record blocked before recording consent, enabled after.  
2. Record → audio on disk → transcript (whisper or manual) → SOAP draft → edit → save → SOAP PDF.  
3. Superbill: UI generates a real local PDF and opens it (`generate_superbill` wired; stub removed or unused).  
4. Invoice → card Checkout → webhook marks paid; pay page does **not** claim a receipt email unless Resend actually sends one. *(pay-page copy fixed; real receipt email still later.)*  
5. SMS reminder can be sent for a test appointment with a phone number.  
6. Docs (this file §2, README, Windows setup) match reality: **no “encrypted SQLite”** claim. *(docs + Settings/i18n swept; keep honest as code changes.)*  
7. Scripted walkthrough on her Windows PC succeeds once with fake clients.

**Active backlog (Gate A only):**

1. ~~Wire `generate_superbill`~~ — command registered, Superbill mounted in sidebar, stub removed. Unit tests cover insert/history + PDF render.  
2. ~~Fix receipt copy~~ — pay page no longer claims an emailed receipt. Optional later: send a real receipt via Resend.  
3. ~~Sweep docs/UI for encryption claims~~ — done for README, desktop README, Windows setup, Settings, i18n, recording consent storage line. Re-check when adding copy.  
4. **Remaining for Gate A exit:** Run and record the Windows fake-client walkthrough on **desktop v0.1.4** ([docs/GATE_A_WALKTHROUGH.md](docs/GATE_A_WALKTHROUGH.md)) — install/pair, clinical path (pause/stop choices + SOAP status), pay → Request superbill → Pending → mark sent; note whisper model that works on her machine. Linux/Omarchy: v0.1.3 mic constraints; v0.1.4 recording → SOAP UX.  

**Out of Gate A:** encryption, attorney consents, calendar, ACH, client portal, backup, job retry, multi-state.

---

### Gate B — Hardening before real PHI

**Intent:** Safe enough that a real client’s chart is not sitting in a plaintext DB we called encrypted, and web ops cannot casually hold clinical narrative.

**Exit criteria (all required):**

1. Local SQLite encrypted at rest (or an explicit, reviewed interim: BitLocker required + in-app warning; prefer real app encryption).  
2. Web appointment `notes` cannot hold clinical content: remove field, or rename/restrict + blocklist/validation, with UX that does not invite SOAP.  
3. Consent templates attorney-reviewed for her license + state; DRAFT warnings removed only after that.  
4. Desktop API key: hashed at rest if feasible, or documented rotation + never returned from GET; no key in logs.  
5. No user-facing claim of encryption, HIPAA-free, or “flags only” that contradicts §2.  
6. Fake-client loop from Gate A still passes after hardening.

**Backlog opens only when Gate A exits.**

---

### Gate C — One real practice week

**Intent:** She runs **one week** of real workflow. Measure friction; do not add Phase-2 features mid-week unless something is broken.

**Exit criteria:**

1. Gate B complete.  
2. At least one real client path: consent → session → note → invoice → paid (or explicit skip with reason).  
3. Written notes: what slowed her down, what she skipped, what she did outside the app.  
4. Nathanael go/no-go on whether to expand users or stay single-practice polish.  

**Success metrics in §1 apply after this gate**, not before.

---

### Gate D — Later (parking lot)

Do not schedule these against A–C. Pull one only after Gate C go.

- Richer scheduling calendar  
- Email appointment reminders  
- Multi-state consent packs  
- Superbill email with explicit therapist confirm  
- ACH + saved payment methods  
- Client portal (next appointment, history, real receipt PDF)  
- Encrypted backup / export  
- Local PHI form library (print / native mail; desktop only)  
- Background job retry  
- Mac build  
- Fee-schedule UX (“client pays X; processor + platform fee”)  
- Single-use therapist magic links  

---

## 4. Compliance posture

- Hard line: no SOAP, Dx, CPT, recordings, transcripts, or superbills on our servers.  
- Web still holds names, contact info, consent text/signatures, appointment metadata, billing amounts — health-adjacent ops; BAAs may still apply. Not legal advice.  
- Therapist remains responsible for clinical/legal practice requirements.  
- Do not market as HIPAA-free. Do not market desktop DB as encrypted until Gate B makes that true.

---

## 5. Build authority (2026-09-18, still in force)

- Resend, Windows first, boilerplate consents, fake clients until counsel, 1% Express only.  
- Autonomous build **within the active gate**.  
- Nathanael: go/no-go on **gate exit**, not continuous feature steering.  

When in doubt: finish Gate A, then stop and ask for go/no-go before Gate B.
