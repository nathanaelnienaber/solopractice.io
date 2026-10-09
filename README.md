# SoloPractice

Local-first therapy practice management for solo LMHCs. Clinical data stays on your desktop — always.

**Product truth and build order live in [`PRODUCT_PLAN.md`](./PRODUCT_PLAN.md).** That file wins if anything here disagrees. Active work is **Gate A** (fake-client loop). Do not use with real clients until Gate B (encryption + attorney-reviewed consents).

## Architecture

```
┌─────────────────────────────┐     ┌──────────────────────────────┐
│  Desktop (Windows first)    │     │  Web                          │
│  - Local SQLite (plaintext) │◀───▶│  - Client intake + consents   │
│  - Audio recording          │sync │  - Schedule + SMS reminders   │
│  - whisper.cpp transcription│     │  - Invoices + Stripe (card)   │
│  - Ollama SOAP drafts       │     │  - Therapist dashboard        │
│  - Superbill PDF            │     │                               │
└─────────────────────────────┘     └──────────────────────────────┘
         │                                      │
         │ clinical chart stays on disk         │
         ▼                                      ▼
   Your local disk only              Contact info, consent text and
                                     signatures, appointments, invoices
```

Desktop sync pulls contact info and consent status via `GET /api/desktop/sync` (`X-Desktop-API-Key`). It does not upload the chart.

## Security Boundaries

**Never leave the desktop / never sync to web:**

- Session audio recordings
- Transcripts
- SOAP notes
- Diagnosis codes (ICD)
- CPT / procedure codes
- Clinical narratives
- Superbills

**Local database:** a normal SQLite file. The app does **not** encrypt it. Use BitLocker (or similar) on the machine until Gate B. Do not sync `%APPDATA%\com.solopractice.desktop` to OneDrive.

**Web portal holds:**

- Client contact info (name, email, phone)
- Consent form text, signatures, and completion status (not “flags only”)
- Appointment schedule, including an optional free-text `notes` field — **not for session content**
- Invoice amounts and payment status

## Monorepo Structure

```
solopractice/
├── PRODUCT_PLAN.md       # North star, current truth, release gates
├── apps/
│   ├── desktop/          # Tauri 2 + React (Windows first)
│   │   ├── src/          # React frontend
│   │   └── src-tauri/    # Rust backend
│   └── web/              # Next.js web app
│       └── src/
│           ├── app/      # App router pages + API routes
│           ├── db/       # Drizzle schema
│           └── lib/      # Stripe, Resend, Twilio, auth
├── packages/
│   └── shared/           # Web vs desktop types + clinical field blocklist
├── docs/
│   └── WINDOWS_SETUP.md  # Windows machine setup
└── .env.example
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Rust (for desktop; see Windows section)
- PostgreSQL (or Neon serverless)

### Installation

```bash
pnpm install
cp .env.example .env
# Edit .env with your API keys
```

### Web App

```bash
pnpm db:generate
pnpm db:push
pnpm dev:web
```

Open [http://localhost:3847](http://localhost:3847)

### Desktop App (Windows)

1. Install Rust from [rustup.rs](https://rustup.rs)
2. Install [VS Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with “Desktop development with C++”
3. WebView2 (usually pre-installed on Windows 10/11)

```powershell
cd apps/desktop
pnpm install
pnpm tauri:dev
# Production: pnpm tauri:build
```

Installer output: `apps/desktop/src-tauri/target/release/bundle/`.  
More detail: [`docs/WINDOWS_SETUP.md`](./docs/WINDOWS_SETUP.md) and [`apps/desktop/README.md`](./apps/desktop/README.md).

## Environment Variables

See `.env.example`.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `RESEND_API_KEY` | Resend API key for emails |
| `TWILIO_*` | Twilio credentials for SMS |

### Stripe Connect

1. Create a Stripe account and enable Connect  
2. Use test mode keys for development  
3. Webhook: `/api/webhooks/stripe`  

Platform fee: **1% on payments** (no monthly subscription). Cards only today.

## Testing with Fake Clients

Consent forms are **DRAFT** templates. Fake clients only until attorney review (Gate B).

1. Sign in via magic link at `/therapist/login`  
2. Clients → Add Client → send consent link  
3. Sign consents in another browser/incognito  
4. Desktop: set API key (Settings / setup wizard), sync — client ready after consents  
5. Record a session (audio local). **v0.1.8+** desktop builds bundle whisper.cpp + `ggml-base.en` (Linux/Windows/Mac Apple Silicon); older builds need Setup download or hand transcript  
6. Review Ollama SOAP draft (local), edit, save  
7. Desktop sidebar → Superbill: pick client, Dx/CPT, letterhead → Generate PDF → open locally  
8. Create invoice → Stripe Checkout (card). Pay page thanks the client; it does not claim a receipt email was sent  

Full Gate A checklist for her Windows PC: [docs/GATE_A_WALKTHROUGH.md](docs/GATE_A_WALKTHROUGH.md).

## Background Jobs

| Job | Tool | Status |
|-----|------|--------|
| Transcription | whisper.cpp CLI | Bundled in v0.1.8+ installers (Mac Apple Silicon from v0.1.8; Linux/Windows from v0.1.7); else Setup download / paths; failed jobs can be continued from SOAP status |
| SOAP draft | Ollama on `127.0.0.1` | Uses configured model (`phi4-mini` if unset) |
| Superbill PDF | Local (`printpdf`) | Sidebar Superbill screen; `generate_superbill` writes under `superbills/` |
| Backup | — | Not implemented |

Jobs are SQLite rows processed on a background thread. Failed jobs stay `failed` (not requeued). Jobs left `in_progress` after a crash are not auto-reset.

## API Security

Write routes reject payloads with clinical field names (defense in depth; schema also excludes them):

```typescript
const CLINICAL_FIELD_BLOCKLIST = [
  "subjective", "objective", "assessment", "plan",
  "diagnosisCodes", "procedureCodes", "transcript",
  "recording", "soapNote", ...
];
```

Response: `400` with `code: "CLINICAL_DATA_REJECTED"`.  
Note: free-text keys like appointment `notes` are **not** on this list — do not put clinical content there.

## Consent Forms

Draft pack (not legal advice):

- Informed Consent for Treatment  
- Notice of Privacy Practices  
- Telehealth Consent  
- Session Recording Consent  
- Limits of Confidentiality  

Before real clients: attorney review, state compliance, remove DRAFT warnings.

## Development

```bash
pnpm typecheck
pnpm test
pnpm dev:web
pnpm dev:desktop   # requires Rust
cd packages/shared && pnpm build
```

## Monetization

- Clinical features: **free**  
- Platform fee: **1%** on successful payments (atop Stripe)  
- No monthly subscription  

## License

Closed-source. All rights reserved.
