# Bundled speech-to-text (whisper.cpp)

Release builds run `apps/desktop/scripts/fetch-whisper-bundle.sh`, which places:

- `models/ggml-base.en.bin` (~142 MB) — Gate A default model
- `tools/…/whisper-cli` (Linux) or `tools/win-x64/whisper-cli.exe` (Windows)

These files are **gitignored** and shipped inside the AppImage / Windows installer
so the first Record → Transcribe → SOAP path works without a separate download.

Local release build:

```bash
./apps/desktop/scripts/fetch-whisper-bundle.sh linux   # or windows
pnpm --filter @solopractice/desktop tauri:build
```
