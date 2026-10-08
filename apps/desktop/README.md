# SoloPractice Desktop — Windows first

Local-first therapy practice management. **Clinical data stays on your device — always.**

> **Target:** Windows 10/11 (first tester: therapist's Windows PC)  
> **Product plan:** [`../../PRODUCT_PLAN.md`](../../PRODUCT_PLAN.md) (active gate, current truth). This README is how-to only.

## Quick Start (Windows)

### Prerequisites

1. **Rust** — Install from [rustup.rs](https://rustup.rs)
2. **Node.js 20+** — Install from [nodejs.org](https://nodejs.org)
3. **pnpm** — `npm install -g pnpm`
4. **Visual Studio Build Tools** — [Download](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   - Select "Desktop development with C++"
5. **WebView2** — Usually pre-installed on Windows 10/11

### Build & Run

```powershell
# From repo root
cd apps/desktop
pnpm install
pnpm tauri:dev
```

For production build:
```powershell
pnpm tauri:build
# Installer: src-tauri/target/release/bundle/msi/SoloPractice_0.1.4_x64.msi
```

---

## Data Storage Location

### ⚠️ IMPORTANT: AppData, NOT OneDrive/Documents

SoloPractice stores clinical data in:

```
%APPDATA%\com.solopractice.desktop\
├── solopractice.db      # SQLite (sessions, SOAP, Dx, CPT). Not encrypted by the app.
├── recordings/          # Audio files
├── exports/             # SOAP PDFs
├── models/              # whisper models (downloaded via setup if not using the bundle)
└── tools/               # whisper binary (downloaded via setup if not using the bundle)
```

**v0.1.7+ installers** also ship whisper.cpp + `ggml-base.en` inside the AppImage / Windows
setup (~150MB larger). The app prefers those bundled paths when app-data downloads are absent.


The app does **not** encrypt the database. Use BitLocker on the PC. **Do NOT** put this folder under OneDrive/Documents — those sync to the cloud.

To find your AppData folder:
1. Press `Win + R`
2. Type `%APPDATA%` and press Enter
3. Look for `com.solopractice.desktop`

---

## Background Job Pipeline

Sessions flow through a durable pipeline that survives app restart:

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│ 1. RECORD   │───▶│ 2. TRANSCRIBE│───▶│ 3. DRAFT    │───▶│ 4. REVIEW    │
│ Save audio  │    │ whisper.cpp  │    │ Ollama LLM  │    │ Edit & sign  │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
     ↓                   ↓                   ↓
   SQLite             SQLite              SQLite
  checkpoint         checkpoint          checkpoint
```

Jobs are persisted to SQLite. If the app crashes or closes:
- Pending jobs are picked up on next launch
- Failed jobs stay `failed` (not requeued)
- Jobs left `in_progress` after a crash are **not** auto-reset to pending
- Superbill PDFs are generated from the Superbill sidebar screen (not a background job)

---

## Installing whisper.cpp (Free Local STT)

whisper.cpp provides free, local speech-to-text without cloud APIs.

**Preferred (v0.1.7+):** use a release AppImage or Windows installer — STT is already bundled.
Release CI runs `scripts/fetch-whisper-bundle.sh` before `tauri build`.

If you are on an older build, or building locally without the bundle, use the options below
(or Session → Download speech-to-text, which auto-continues transcription when ready).

### Option A: Pre-built Binaries

1. Download from [whisper.cpp releases](https://github.com/ggerganov/whisper.cpp/releases)
2. Extract to `C:\Users\<you>\whisper.cpp\`
3. Download a model:
   ```powershell
   cd C:\Users\<you>\whisper.cpp
   # Download base.en model (~150MB, good balance of speed/quality)
   Invoke-WebRequest -Uri "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin" -OutFile "models\ggml-base.en.bin"
   ```

### Option B: Build from Source

```powershell
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
cmake -B build
cmake --build build --config Release
```

### Configure in SoloPractice

1. Open SoloPractice → Settings
2. Set **Whisper Path**: `C:\Users\<you>\whisper.cpp\build\bin\Release\main.exe`
3. Set **Whisper Model Path**: `C:\Users\<you>\whisper.cpp\models\ggml-base.en.bin`
4. Model Size: `base` (recommended for typical PCs)

**Model Size Guide:**

| Model | Size | Speed | Quality | RAM |
|-------|------|-------|---------|-----|
| tiny | 75MB | Fastest | Basic | 1GB |
| base | 142MB | Fast | Good | 2GB |
| small | 466MB | Medium | Better | 3GB |
| medium | 1.5GB | Slow | Great | 5GB |
| large | 2.9GB | Slowest | Best | 10GB |

---

## Installing Ollama (Free Local LLM)

Ollama runs local language models for SOAP draft generation.

### Installation

1. Download from [ollama.ai](https://ollama.ai)
2. Run installer
3. Pull a model:
   ```powershell
   ollama pull llama3.2
   ```

### Configure in SoloPractice

1. Open SoloPractice → Settings
2. Set **Ollama Path**: `ollama` (if in PATH) or full path
3. Set **Ollama Model**: `llama3.2`

**Recommended Models:**

| Model | Size | Speed | Notes |
|-------|------|-------|-------|
| llama3.2 | 2GB | Fast | Good for SOAP |
| llama3.2:3b | 2GB | Faster | Lighter |
| mistral | 4GB | Medium | Alternative |

---

## Testing with Fake Clients

⚠️ **Use only fake/test clients until consent forms are attorney-reviewed.**

### Test Flow

1. **Start web portal** (from repo root):
   ```powershell
   pnpm dev:web
   ```
   Open http://localhost:3847

2. **Create therapist account**:
   - Go to Therapist Sign In
   - Enter test email
   - (In development, magic link is logged to console)

3. **Add fake client**:
   - Dashboard → Clients → Add Client
   - Use fake name/email: "Test Client", test@fake.local

4. **Send consent invite**:
   - Click "Send consent link"
   - Open link in incognito to sign forms

5. **Start desktop app**:
   ```powershell
   pnpm tauri:dev
   ```

6. **Record test session**:
   - Select client (should show "Ready" after consents)
   - Click "Start Recording"
   - Speak test content
   - Click "Stop Recording"
   - Watch job queue process

7. **Edit SOAP draft**:
   - Review AI-generated draft
   - Make edits
   - Save (not draft = signed)

---

## Mock Mode (No whisper/Ollama)

If whisper.cpp or Ollama aren't installed, SoloPractice uses **mock workers**:

- Mock whisper: Returns placeholder transcript
- Mock Ollama: Returns template SOAP draft

This lets you test the full UI flow without installing dependencies.

Mock mode is indicated in the Background Jobs tab:
```
○ whisper.cpp    ○ Ollama (mock mode for unavailable workers)
```

---

## Security: No PHI on Web

### Hard Rule

The following **NEVER** leave the desktop:

- Audio recordings
- Transcripts
- SOAP notes
- Diagnosis codes (ICD)
- Procedure codes (CPT)
- Clinical narratives
- Superbills

### Web API Protection

The web API actively rejects clinical payloads:

```typescript
// Blocklist includes: subjective, objective, assessment, plan,
// diagnosisCodes, transcript, recording, soapNote, etc.

assertWebSafePayload(requestBody);
// Throws WebSafetyViolationError if clinical fields detected
```

### Where data lives

```
Desktop SQLite:                Web Postgres:
├── sessions                   ├── clients (contact)
├── recordings                 ├── consents (form text + signatures + status)
├── transcripts                ├── appointments (incl. free-text notes — not for clinical content)
├── soap_notes                 └── invoices
├── superbills
└── local_forms (table only; no UI yet)
```

Desktop sync downloads contact info and consent status. It never uploads the clinical chart.

---

## Environment Variables (Web Portal)

The desktop app doesn't need env vars, but the web portal does:

```env
# .env (copy from .env.example)
DATABASE_URL=postgresql://...
STRIPE_SECRET_KEY=sk_test_...
RESEND_API_KEY=re_...
TWILIO_ACCOUNT_SID=AC...
```

For local development without real APIs, the web portal logs stubs to console.

---

## Troubleshooting

### "whisper.cpp not found"
→ Set full path in Settings, or install per instructions above

### "Ollama failed"
→ Ensure Ollama is running: `ollama serve`

### Recording not working
→ Audio capture requires Windows audio permissions

### Jobs stuck "in_progress"
→ Not auto-recovered today. Mark or clear the row in the local DB only if you know what you are doing, or re-queue by creating a new job from the UI where available.

### Database locked
→ Close any other SQLite viewers (DB Browser, etc.). Only one app instance at a time.

---

## File Structure

```
apps/desktop/
├── src/                    # React frontend
│   ├── components/
│   │   ├── ClientList.tsx
│   │   ├── SessionPanel.tsx
│   │   ├── SoapEditor.tsx
│   │   ├── JobQueue.tsx
│   │   └── Settings.tsx
│   └── App.tsx
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── lib.rs          # App entry
│   │   ├── commands.rs     # Tauri commands
│   │   ├── db.rs           # SQLite schema
│   │   └── jobs.rs         # Background pipeline
│   └── tauri.conf.json
└── README.md               # This file
```

---

## License

Closed-source. All rights reserved.
