# Gate A — Fake-client walkthrough (Windows)

**Purpose:** Prove the full practice loop with **test data only** on her Windows PC.  
**Do not use real clients.** Consent forms are still DRAFT until Gate B attorney review.

Record results in the table at the bottom. When every row passes (or a blocker is written with a reason), Gate A can go to Nathanael for go/no-go before Gate B.

## Prerequisites

- Web app reachable with test Stripe / Resend / Twilio / Neon configured  
- Desktop built or installed on Windows 10/11  
- Desktop API key from web Settings → pasted in desktop setup / Settings  
- whisper.cpp + model **or** plan to enter transcript by hand  
- Ollama running locally with a model (or skip AI draft and write SOAP by hand)

## Checklist

| # | Step | Pass? | Notes |
|---|------|-------|-------|
| 1a | Therapist magic link → signed in | | |
| 1b | Add fake client → send consent invite | | |
| 1c | Sign all five consents in another browser | | |
| 1d | Desktop sync shows client ready | | |
| 1e | Record **blocked** before recording consent; **enabled** after | | |
| 2a | Record session → audio file under `%APPDATA%\com.solopractice.desktop\recordings\` | | |
| 2b | Transcript via whisper **or** manual entry | Whisper model: ________ | |
| 2c | SOAP draft (Ollama or hand) → edit → save | | |
| 2d | Export SOAP PDF (finalized only) → opens | | |
| 3a | Sidebar → Superbill → generate PDF | | |
| 3b | PDF under `%APPDATA%\com.solopractice.desktop\superbills\` and opens | | |
| 3c | Superbill History lists the new row; Open works | | |
| 4a | Web: create invoice → Stripe Checkout (test card) | | |
| 4b | Webhook marks paid; pay page does **not** claim an emailed receipt | | |
| 5 | Web: send SMS reminder for a test appointment (client has a phone) | | |
| 6 | Docs/UI: no claim that the local SQLite DB is encrypted | | |

## Whisper model decision

Record what worked on her PC (size vs quality):

- Model: ________  
- Approximate session length tried: ________  
- Acceptable quality? Y/N  

Update `PRODUCT_PLAN.md` §2 Decisions log when chosen.

## Blockers

If a step fails for environment (keys, Ollama, whisper binary), write it here. Do **not** start Gate B until Gate A exits or Nathanael explicitly re-scopes.

- **2026-10-03:** Live Windows walkthrough not run in this build session (no access to her Windows PC from the builder environment). Code path verified via Rust unit tests (`generate_superbill` insert/history + `generate_superbill_pdf`). Run this checklist on her machine next; record whisper model in the table above and clear this blocker when done.

## Sign-off

- Date run: ________  
- Runner: ________  
- Gate A ready for go/no-go? ________  
