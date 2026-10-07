# Gate A — Fake-client walkthrough

**Purpose:** Prove the full practice loop with **test data only**. Developers/testers on Linux can run the checklist with the **AppImage**; Gate A exit still needs one successful pass on **her Windows PC** (PRODUCT_PLAN “Windows first”).  
**Desktop build:** **v0.1.4** (recording pause + stop choices + SOAP pipeline status; v0.1.3 mic/GStreamer retained).  
**Do not use real clients.** Consent forms are still DRAFT until Gate B attorney review.

Record results in the tables below. When every required row passes (or a blocker is written with a reason), Gate A can go to Nathanael for go/no-go before Gate B.

**Kickoff checklist (Project store):** run order + what to report back lives in the Project doc `docs/gate-a-kickoff.md`. This file remains the repo source of truth for pass/fail.

---

## Install & pair (v0.1.4)

| Item | Link / note |
|------|-------------|
| Release | https://github.com/nathanaelnienaber/solopractice.io/releases/tag/v0.1.4 |
| **Linux AppImage** (dev / Omarchy) | https://github.com/nathanaelnienaber/solopractice.io/releases/download/v0.1.4/SoloPractice_0.1.4_amd64.AppImage |
| Windows setup.exe | https://github.com/nathanaelnienaber/solopractice.io/releases/download/v0.1.4/SoloPractice_0.1.4_x64-setup.exe |
| Windows MSI | https://github.com/nathanaelnienaber/solopractice.io/releases/download/v0.1.4/SoloPractice_0.1.4_x64_en-US.msi |
| In-app / site download | Web → `/download` or Settings → Download desktop app |

**Linux:** download the AppImage → `chmod +x SoloPractice_0.1.4_amd64.AppImage` → run it. No auto-update — use a fresh AppImage for each release.

**Windows (unsigned installer):** SmartScreen → **More info** → **Run anyway**. No auto-update — use a fresh installer for each release.

1. Remove older SoloPractice builds (v0.1.3 and earlier) — uninstall on Windows; replace the AppImage on Linux.
2. Install / launch **0.1.4** (AppImage on Linux, or Windows setup.exe / MSI).
3. Web: therapist magic link → **Settings** → copy Desktop API key.
4. Desktop: paste key in setup wizard / Settings → **Sync** (or equivalent). Confirm clients pull.
5. Optional for transcript/SOAP: complete ML setup (whisper.cpp + model, Ollama) **or** plan to enter transcript / SOAP by hand.

### Prerequisites

- Web app reachable with test Stripe / Resend / Twilio / Neon configured  
- Desktop **0.1.4** installed and paired as above  
- Fake-client data only  

### Local data paths

| Platform | App data directory |
|----------|--------------------|
| Linux | `~/.local/share/com.solopractice.desktop/` |
| Windows | `%APPDATA%\com.solopractice.desktop\` |

Recordings land under `recordings/`; superbills under `superbills/`.

---

## Checklist

### 1 — Fake client web ops (consents)

| # | Step | Pass? | Notes |
|---|------|-------|-------|
| 1a | Therapist magic link → signed in | | |
| 1b | Add fake client → send consent invite | | |
| 1c | Sign all five consents in another browser | | |
| 1d | Desktop sync shows client ready | | |
| 1e | Record **blocked** before recording consent; **enabled** after | | |

### 2 — Desktop clinical path

| # | Step | Pass? | Notes |
|---|------|-------|-------|
| 2a | Record → **Pause** works; **Stop** shows choices (SOAP / continue / save audio / auto-transcribe+SOAP) | | |
| 2b | Audio under app data `recordings/` (see paths above) | | |
| 2c | Transcript via whisper **or** manual entry; SOAP screen shows local AI status (not a blank silent editor) | Whisper model: ________ (see pick table) |
| 2d | SOAP draft (Ollama or hand) → edit → save | | |
| 2e | Export SOAP PDF (finalized only) → opens | | |

### 3 — Superbill PDF (sidebar generate)

| # | Step | Pass? | Notes |
|---|------|-------|-------|
| 3a | Sidebar → Superbill → generate PDF (letterhead + DOB + ≥1 Dx + ≥1 CPT) | | |
| 3b | PDF under app data `superbills/` and opens | | |
| 3c | Superbill History lists the new row; Open works | | |

### 4 — Pay + superbill request → Pending fulfill → mark sent *(0.1.2+)*

Clinical PDF stays on the desktop. Cloud holds **request status only** (`none` → `requested` → `sent`). No Dx / CPT / DOB / PDF on the web.

| # | Step | Pass? | Notes |
|---|------|-------|-------|
| 4a | Web: create invoice → Stripe Checkout (test card) | | |
| 4b | Webhook marks paid; pay page shows on-page receipt; does **not** claim an emailed receipt | | |
| 4c | Pay page → **Request superbill** → status requested; therapist invoice badge shows **Superbill requested** | | |
| 4d | Desktop → Superbill → **Pending** → Prepare → generate PDF (DOB + Dx/CPT + letterhead required) → Open mail client / Open PDF → **Mark sent** | | |
| 4e | Pay page / invoice shows **Superbill sent** (status only; no PDF download from web) | | |

### 5 — Reminder + honesty

| # | Step | Pass? | Notes |
|---|------|-------|-------|
| 5 | Web: send SMS reminder for a test appointment (client has a phone) | | |
| 6 | Docs/UI: no claim that the local SQLite DB is encrypted | | |

---

## Whisper model pick

Setup wizard defaults to **`ggml-base.en`**. Settings also expose a size picker (tiny → large). Try **base** first; step down if too slow, step up only if quality fails.

Dev/tester runs on Linux are useful for the loop; **record the Gate A exit model after a try on her Windows PC**.

| Model | Approx. size | Speed | Quality | Try when |
|-------|--------------|-------|---------|----------|
| tiny | ~75MB | Fastest | Basic | Low RAM / just proving the loop |
| **base** (recommended) | ~142MB | Fast | Good | Default starting point |
| small | ~466MB | Moderate | Better | Base quality not acceptable |
| medium | ~1.5GB | Slow | High | Powerful PC; quality matters |
| large | ~2.9GB | Slowest | Best | Usually overkill for Gate A |

**Decision record** (fill after a real session-length try):

| Field | Value |
|-------|--------|
| Platform | Linux AppImage / Windows (her PC): ________ |
| Model chosen | ________ |
| How obtained | Setup wizard / Settings / manual path: ________ |
| Approx. session length tried | ________ |
| Acceptable quality? | Y / N |
| Notes (CPU, RAM, time to finish) | ________ |

Update `PRODUCT_PLAN.md` §2 Decisions log when chosen (her-PC model for Gate A exit).

---

## Blockers

If a step fails for environment (keys, Ollama, whisper binary), write it here. Do **not** start Gate B until Gate A exits or Nathanael explicitly re-scopes.

- **2026-10-03:** Live Windows walkthrough not run in this build session (no access to her Windows PC from the builder environment). Code path verified via Rust unit tests (`generate_superbill` insert/history + `generate_superbill_pdf`).
- **2026-10-07:** Docs updated for **v0.1.3** (install/pair + Pending fulfill). **Live Windows run still pending** — clear this blocker only after she completes the checklist and records the whisper model above.
- **2026-10-07:** Install docs clarify **Linux AppImage** for developers/testers (Omarchy); Windows remains required for Gate A exit on her PC. Live Linux walkthrough still pending Nathanael’s run.
- **2026-10-07:** **v0.1.4** — recording pause, stop choices, SOAP pipeline status. Retest AppImage on Omarchy after mic fix (0.1.3).

---

## Sign-off

- Date run: ________  
- Runner: ________  
- Platform: ________ (Linux AppImage and/or Windows)  
- Desktop version confirmed: ________ (expect **0.1.4**)  
- Whisper model recorded: ________  
- Gate A ready for go/no-go? ________  
