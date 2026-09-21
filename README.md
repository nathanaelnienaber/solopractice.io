# SoloPractice

Local-first therapy practice management for solo LMHCs. Clinical data stays on your desktop — always.

## Architecture

```
┌─────────────────────────────┐     ┌──────────────────────────────┐
│  Desktop (Windows)          │     │  Web                          │
│  - Encrypted SQLite         │◀───▶│  - Client intake + consents   │
│  - Audio recording          │sync │  - Schedule + SMS reminders   │
│  - whisper.cpp transcription│flags│  - Invoices + Stripe payments │
│  - Local LLM SOAP drafts    │only │  - Therapist dashboard        │
│  - Superbill PDF generation │     │                               │
└─────────────────────────────┘     └──────────────────────────────┘
         │                                      │
         │ NEVER uploads clinical data          │
         ▼                                      ▼
   Your local disk only              Consent flags, contact info,
                                     payment status only
```

## Security Boundaries

**The following NEVER leave your desktop / NEVER sync to web:**

- Session audio recordings
- Transcripts
- SOAP notes
- Diagnosis codes (ICD)
- CPT / procedure codes
- Clinical narratives
- Superbills

**Web portal holds only:**

- Client contact info (name, email, phone)
- Consent completion flags (not content)
- Appointment schedule
- Invoice amounts and payment status

## Monorepo Structure

```
solopractice/
├── apps/
│   ├── desktop/          # Tauri 2 + React (Windows MVP)
│   │   ├── src/          # React frontend
│   │   └── src-tauri/    # Rust backend
│   └── web/              # Next.js web app
│       └── src/
│           ├── app/      # App router pages
│           ├── db/       # Drizzle schema
│           └── lib/      # Stripe, Resend, Twilio
├── packages/
│   └── shared/           # Shared types with PHI boundary enforcement
└── .env.example          # Environment template
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Rust (for desktop, see Windows instructions below)
- PostgreSQL (or Neon serverless)

### Installation

```bash
# Clone and install dependencies
pnpm install

# Copy environment template
cp .env.example .env
# Edit .env with your API keys
```

### Web App

```bash
# Generate database schema
pnpm db:generate

# Push schema to database
pnpm db:push

# Start development server
pnpm dev:web
```

Open [http://localhost:3847](http://localhost:3847)

### Desktop App (Windows)

#### Windows Prerequisites

1. **Install Rust**: Download from [rustup.rs](https://rustup.rs)
2. **Install Visual Studio Build Tools**:
   - Download [VS Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   - Select "Desktop development with C++"
3. **Install WebView2**: Usually pre-installed on Windows 10/11

#### Running on Windows

```powershell
# Navigate to desktop app
cd apps/desktop

# Install dependencies
pnpm install

# Run in development mode
pnpm tauri:dev

# Build for production
pnpm tauri:build
```

The installer will be in `apps/desktop/src-tauri/target/release/bundle/`.

## Environment Variables

See `.env.example` for all required variables.

### Required for Web

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `RESEND_API_KEY` | Resend API key for emails |
| `TWILIO_*` | Twilio credentials for SMS |

### Stripe Connect Setup

1. Create a Stripe account
2. Enable Connect in your dashboard
3. Use test mode keys for development
4. Set up webhook endpoint: `/api/webhooks/stripe`

Platform fee: **1% on all payments** (no monthly subscription)

## Testing with Fake Clients

⚠️ **Important**: The consent forms are DRAFT templates. Do not use with real clients until reviewed by an attorney.

### Testing Flow

1. **Create therapist account**: Sign in via magic link at `/therapist/login`
2. **Add test client**: Go to Clients → Add Client
3. **Send consent invite**: Click "Send consent link"
4. **Sign consents**: Open the link in another browser/incognito
5. **Test desktop sync**: Desktop app shows client as "Ready" after consents
6. **Record session**: Start recording (uses stub - real whisper.cpp integration TBD)
7. **Edit SOAP**: Review AI-generated draft, edit, and save
8. **Create invoice**: Send invoice via Stripe

## Background Jobs

The desktop app processes these in the background:

| Job | Tool | Status |
|-----|------|--------|
| Transcription | whisper.cpp | Stub (interface ready) |
| SOAP Draft | Ollama | Stub (interface ready) |
| Superbill PDF | Local | Stub (interface ready) |
| Backup | Local | Stub (interface ready) |

Jobs queue in SQLite and process without blocking the UI.

## API Security

The web API rejects any payload containing clinical fields:

```typescript
const CLINICAL_FIELD_BLOCKLIST = [
  "subjective", "objective", "assessment", "plan",
  "diagnosisCodes", "procedureCodes", "transcript",
  "recording", "soapNote", ...
];
```

Attempting to POST clinical data returns:

```json
{
  "error": "Request rejected: contains prohibited clinical fields",
  "code": "CLINICAL_DATA_REJECTED"
}
```

## Consent Forms

Draft boilerplate forms included (clearly marked NOT LEGAL ADVICE):

- Informed Consent for Treatment
- Notice of Privacy Practices
- Telehealth Consent
- Session Recording Consent
- Limits of Confidentiality

**Before using with real clients:**

1. Have an attorney review and customize
2. Ensure compliance with your state's requirements
3. Remove "DRAFT" warnings

## Development

```bash
# Type check all packages
pnpm typecheck

# Run web dev server
pnpm dev:web

# Run desktop dev (requires Rust)
pnpm dev:desktop

# Build shared package
cd packages/shared && pnpm build
```

## Monetization

- Clinical features: **Free**
- Platform fee: **1% on payments** (on top of Stripe fees)
- No monthly subscription

## License

Closed-source. All rights reserved.
