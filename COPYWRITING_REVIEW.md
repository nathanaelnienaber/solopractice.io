# Copywriting Review Needed

**Status:** Awaiting professional copywriter review

## Goal

All user-facing text in SoloPractice needs to be reviewed by a professional copywriter to ensure it is:

1. **Simple and clear** — No jargon or technical terms
2. **Friendly and warm** — Appropriate tone for therapy practice software
3. **Reassuring** — Especially around privacy and data security
4. **Consistent** — Same voice across web and desktop apps

## Target Audience

The primary users are:
- **Therapists** (LMHCs, LCSWs, psychologists) — Often not tech-savvy, busy with clients
- **Clients** — Seeking therapy, may be anxious, need reassurance and simplicity

## Files to Review

### Web App (`apps/web/`)

| File | What it contains |
|------|------------------|
| `src/lib/i18n.tsx` | All translatable strings for web (EN, ES, DE, SV) |
| `src/lib/consent-templates.ts` | Draft consent form text (CRITICAL: legal review also needed) |
| `src/app/page.tsx` | Marketing homepage |
| `src/app/therapist/login/page.tsx` | Therapist sign-in page |
| `src/app/client/consent/[token]/page.tsx` | Client consent signing flow |

### Desktop App (`apps/desktop/`)

| File | What it contains |
|------|------------------|
| `src/lib/i18n.tsx` | All translatable strings for desktop (EN, ES, DE, SV) |
| `src/components/*.tsx` | UI component labels and messages |

## Key Principles for Review

### Replace Technical Terms

| Instead of... | Say... |
|---------------|--------|
| "API" | "connection" |
| "Database" | "your data" |
| "Sync" | "update" |
| "Authenticate" | "sign in" |
| "Token" | "link" |
| "Transcription" | "written version of your recording" |
| "SOAP note" | "session notes" |
| "Pipeline" | "process" |
| "Queue" | "list" |

### Tone Examples

**Too technical:**
> "Your session data is encrypted at rest and in transit using AES-256-GCM."

**Better:**
> "Your session notes are protected and stay only on your computer."

**Too technical:**
> "Configure the Ollama model path in settings."

**Better:**
> "Tell us where you installed the note-writing tool."

### Privacy Messaging

Users need constant reassurance that their private information is safe. The messaging should:
- Be specific about what stays local
- Avoid scary security jargon
- Feel human, not robotic

## Languages

The app supports 4 languages. After English copy is finalized:
1. Professional translation for Spanish, German, Swedish
2. Native speaker review for each language
3. Ensure cultural appropriateness (not just word-for-word translation)

## Consent Forms (Special Note)

The consent form templates in `src/lib/consent-templates.ts` are marked as **DRAFT — NOT LEGAL ADVICE**. These need:

1. **Legal review** by a healthcare attorney (state-specific)
2. **Copywriting review** for clarity and readability
3. **Translation** by professional legal translators

Do NOT use these forms with real clients until they have been reviewed by a qualified attorney in your jurisdiction.

## How to Submit Changes

Once a copywriter has reviewed the text:
1. Edit the translation files directly, or
2. Provide a document with suggested changes for each string key

## Contact

For questions about this review, contact the development team.
