# Bundled speech-to-text (whisper.cpp)

Release builds run `apps/desktop/scripts/fetch-whisper-bundle.sh`, which places:

- `models/ggml-base.en.bin` (~142 MB) — Gate A default model
- `tools/…/whisper-cli` (Linux), `tools/win-x64/whisper-cli.exe` (Windows),
  or `tools/macos-arm64/whisper-cli` (macOS Apple Silicon; built from source in CI)

These files are **gitignored** and shipped inside the AppImage / Windows installer /
macOS `.app` / `.dmg` so the first Record → Transcribe → SOAP path works without a
separate download.

Local release build:

```bash
./apps/desktop/scripts/fetch-whisper-bundle.sh linux   # or windows | macos
pnpm --filter @solopractice/desktop tauri:build
```

`macos` must run on Darwin (builds whisper-cli from the release tag; Metal embedded).
