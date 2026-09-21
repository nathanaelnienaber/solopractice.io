# solopractice

Local-first practice management for solo mental health counselors.

**IMPORTANT: This is a development scaffold with fake/test data only. Not for production use with real clients until consent forms are attorney-reviewed.**

## Overview

solopractice is a two-part system:
- **Desktop App** (Tauri/Windows): Local-only clinical data management — SOAP notes, session recordings, transcripts, diagnoses, superbills
- **Web App** (Next.js): Client-facing portal — intake consents, appointment reminders, invoice payments

### Security Model

**Clinical data NEVER leaves the desktop.** The hard boundary:

| Data Type | Storage | Syncs to Web? |
|-----------|---------|---------------|
| SOAP notes | Desktop SQLite | ❌ NEVER |
| Session recordings | Local disk | ❌ NEVER |
| Transcripts | Desktop SQLite | ❌ NEVER |
| Diagnosis codes (ICD) | Desktop SQLite | ❌ NEVER |
| CPT codes | Desktop SQLite | ❌ NEVER |
| Superbills | Desktop PDF | ❌ NEVER |
| Client contact info | Both | ✅ Yes (ops) |
| Consent status flags | Both | ✅ Yes (ops) |
| Appointments | Web DB | ✅ Yes (ops) |
| Invoices (amount/date) | Web DB | ✅ Yes (ops) |

## Project Structure

```
solopractice/
├── apps/
│   ├── desktop/          # Tauri 2 Windows app
│   │   ├── src/          # React frontend
│   │   └── src-tauri/    # Rust backend with SQLite
│   └── web/              # Next.js client portal
│       └── src/
│           ├── app/      # Pages (consents, invoices)
│           └── lib/      # Stripe, Resend, Twilio integrations
├── packages/
│   └── shared/           # PHI boundary types + web-safety guards
└── scripts/
    └── seed-fake-clients.js
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Rust (for desktop app)
- Windows 10/11 (for desktop MVP)

### Install

```bash
pnpm install
```

### Development

**Web app:**
```bash
pnpm dev:web
# Open http://localhost:3000
```

**Desktop app (Windows):**
```bash
pnpm dev:desktop
# Or: cd apps/desktop && pnpm tauri:dev
```

### Run Tests

```bash
# Run all tests (including PHI boundary tests)
pnpm test

# Run shared package tests only
pnpm test:shared
```

## PHI Boundary Tests

The `@solopractice/shared` package includes critical tests that verify clinical data cannot leak to web payloads:

```typescript
import { assertWebSafePayload } from '@solopractice/shared';

// This MUST throw — clinical data detected
assertWebSafePayload({ id: '123', transcript: 'clinical content' });
// PHIBoundaryViolationError: Clinical field "transcript" detected

// This is safe
assertWebSafePayload({ id: '123', email: 'client@example.com' });
```

Run these tests before every release:
```bash
pnpm test:shared
```

## Windows Setup

See [docs/WINDOWS_SETUP.md](docs/WINDOWS_SETUP.md) for detailed Windows setup instructions including:
- Whisper.cpp installation for local STT
- Ollama installation for local SOAP generation
- SQLite encryption setup

## Environment Variables

### Web App (`apps/web/.env.local`)

```env
# Stripe Connect (Express)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Resend (email)
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@yourdomain.com

# Twilio (SMS)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Stripe Connect

The platform uses Stripe Connect Express with a 1% application fee:

1. Therapist onboards via Stripe-hosted Express dashboard
2. Clients pay invoices via Stripe Checkout
3. Platform takes 1% application fee
4. Therapist receives payout minus Stripe + platform fees

## Consent System

1. Therapist creates client in desktop app
2. Client is greyed out (not selectable for sessions)
3. Therapist sends consent invite via web
4. Client e-signs required consents
5. Consent status syncs to desktop → client becomes selectable
6. Recording is blocked until recording consent is signed

### Consent Pack (MVP)

- Informed Consent for Treatment
- Notice of Privacy Practices
- Session Recording Consent
- Limits of Confidentiality
- Telehealth Consent (optional)

**WARNING:** Consent templates are boilerplate drafts. Get attorney review before using with real clients.

## Background Processing

Session recording → transcript → SOAP follows a local background queue:

1. **Record**: Audio saved to local disk (WAV)
2. **Transcribe**: Whisper.cpp processes audio (background, may take 5-15 min)
3. **Generate SOAP**: Ollama creates draft (background, ~1-2 min)
4. **Review**: Therapist edits and finalizes SOAP

All processing happens locally. The UI remains responsive while jobs run in background.

## License

Closed source. Copyright 2026.
