#!/usr/bin/env bash
# Download whisper.cpp CLI + ggml-base.en into src-tauri/resources/whisper/
# for bundling into AppImage / Windows installers (Gate A default model).
#
# Usage:
#   ./apps/desktop/scripts/fetch-whisper-bundle.sh [linux|windows|all]
#
# Size tradeoff (approx):
#   ggml-base.en.bin  ~142 MB
#   Linux ubuntu x64  ~10 MB (tar.gz unpacked larger with .so libs)
#   Windows x64 zip   ~9 MB
# Total installer delta ≈ 150–160 MB — accepted so first Record → Transcribe → SOAP
# works offline without a separate STT download.
#
# Artifacts are gitignored; CI runs this before `tauri build`.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RES="$ROOT/src-tauri/resources/whisper"
PLATFORM="${1:-}"
WHISPER_TAG="${WHISPER_BUNDLE_TAG:-b5454}"
MODEL_URL="${WHISPER_MODEL_URL:-https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin}"
MODEL_NAME="ggml-base.en.bin"
GH_BASE="https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_TAG}"

if [[ -z "$PLATFORM" ]]; then
  case "$(uname -s)" in
    Linux*) PLATFORM=linux ;;
    MINGW*|MSYS*|CYGWIN*|Windows_NT) PLATFORM=windows ;;
    *)
      echo "Pass linux, windows, or all (got uname=$(uname -s))" >&2
      exit 1
      ;;
  esac
fi

mkdir -p "$RES/models" "$RES/tools"
# Remove Tauri resource placeholders once real artifacts land.
rm -f "$RES/models/KEEP.txt" "$RES/tools/KEEP.txt"
rm -rf "$RES/tools/_placeholder"

fetch() {
  local url="$1" dest="$2"
  if [[ -f "$dest" && -s "$dest" ]]; then
    echo "Already present: $dest"
    return 0
  fi
  echo "Downloading $url → $dest"
  curl -fL --retry 3 --retry-delay 2 -o "$dest.part" "$url"
  mv "$dest.part" "$dest"
}

fetch "$MODEL_URL" "$RES/models/$MODEL_NAME"

unpack_linux() {
  local archive="$RES/tools/whisper-bin-ubuntu-x64.tar.gz"
  fetch "${GH_BASE}/whisper-bin-ubuntu-x64.tar.gz" "$archive"
  # Keep nested folder + shared libs ($ORIGIN RUNPATH).
  rm -rf "$RES/tools/whisper-bin-ubuntu-x64"
  tar -xzf "$archive" -C "$RES/tools"
  rm -f "$archive"
  local cli
  cli="$(find "$RES/tools" -type f \( -name whisper-cli -o -name main \) | head -n1)"
  if [[ -z "$cli" ]]; then
    echo "whisper-cli missing after Linux unpack" >&2
    exit 1
  fi
  chmod +x "$cli"
  echo "Linux STT binary: $cli"
}

unpack_windows() {
  local archive="$RES/tools/whisper-bin-x64.zip"
  fetch "${GH_BASE}/whisper-bin-x64.zip" "$archive"
  rm -rf "$RES/tools/win-x64"
  mkdir -p "$RES/tools/win-x64"
  if command -v unzip >/dev/null 2>&1; then
    unzip -qo "$archive" -d "$RES/tools/win-x64"
  else
    python3 - "$archive" "$RES/tools/win-x64" <<'PY'
import sys, zipfile
zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])
PY
  fi
  rm -f "$archive"
  # Prefer whisper-cli.exe; fall back to main.exe
  local cli=""
  if [[ -f "$RES/tools/win-x64/whisper-cli.exe" ]]; then
    cli="$RES/tools/win-x64/whisper-cli.exe"
  elif [[ -f "$RES/tools/win-x64/main.exe" ]]; then
    mv "$RES/tools/win-x64/main.exe" "$RES/tools/win-x64/whisper-cli.exe"
    cli="$RES/tools/win-x64/whisper-cli.exe"
  else
    cli="$(find "$RES/tools/win-x64" -iname 'whisper-cli.exe' -o -iname 'main.exe' | head -n1 || true)"
    if [[ -n "$cli" && "$(basename "$cli")" == "main.exe" ]]; then
      mv "$cli" "$(dirname "$cli")/whisper-cli.exe"
      cli="$(dirname "$cli")/whisper-cli.exe"
    fi
  fi
  if [[ -z "$cli" || ! -f "$cli" ]]; then
    echo "whisper-cli.exe missing after Windows unpack" >&2
    exit 1
  fi
  echo "Windows STT binary: $cli"
}

case "$PLATFORM" in
  linux) unpack_linux ;;
  windows) unpack_windows ;;
  all)
    unpack_linux
    unpack_windows
    ;;
  *)
    echo "Unknown platform: $PLATFORM (use linux|windows|all)" >&2
    exit 1
    ;;
esac

# Marker so the app can report “bundled with this install”
cat > "$RES/BUNDLE_INFO.txt" <<EOF
whisper_tag=${WHISPER_TAG}
model=${MODEL_NAME}
platform=${PLATFORM}
bundled_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

echo "Whisper bundle ready under $RES"
du -sh "$RES" "$RES/models/$MODEL_NAME" 2>/dev/null || true
