# Copywriting Review Needed

**Status:** Superseded for web voice by the Project voice guide — see [`docs/voice-and-copy.md`](/cursor/stores/self/docs/voice-and-copy.md) (store) after the B2C web copy pass. Desktop strings and consent legal bodies remain open (Gate B attorney for consents).

**Product claims:** Follow [`PRODUCT_PLAN.md`](./PRODUCT_PLAN.md) §2 (current truth) and §4 (compliance). Do not invent encryption, HIPAA-free, or “flags only” language.

## Goal

All user-facing text in SoloPractice needs to stay:

1. **Simple and clear** — No jargon or technical terms in UI
2. **Friendly and warm** — Appropriate tone for therapy practice software
3. **Honest** — Especially around privacy (desktop clinical; no false encryption claims)
4. **Consistent** — Same voice across web and desktop apps (desktop pass still pending)

## Target Audience

- **Therapists** (solo LMHCs) — Busy; phone-first for ops
- **Clients** — Consent/pay links; calm and simple

## Files

### Web App (`apps/web/`)

| File | What it contains |
|------|------------------|
| `src/lib/i18n.tsx` | Translatable strings (EN, ES, DE, SV) |
| `src/lib/consent-templates.ts` | Draft consent form text (attorney review still needed) |
| `src/app/page.tsx` | Marketing homepage |
| `src/app/therapist/login/page.tsx` | Therapist sign-in |
| `src/app/client/consent/[token]/page.tsx` | Client consent signing flow |
| `src/lib/email.ts` | Magic link, consent invite, invoice emails |

### Desktop App (`apps/desktop/`)

| File | What it contains |
|------|------------------|
| `src/lib/i18n.tsx` | Desktop strings — **not** covered by the web copy pass |
| `src/components/*.tsx` | UI labels |

## Consent Forms (Special Note)

Templates in `src/lib/consent-templates.ts` are **DRAFT — NOT LEGAL ADVICE**. Do not use with real clients until attorney review (Gate B).
