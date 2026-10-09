#!/usr/bin/env bash
# Download/build whisper.cpp CLI + ggml-base.en into src-tauri/resources/whisper/
# for bundling into AppImage / Windows installers / macOS .app/.dmg (Gate A default model).
#
# Usage:
#   ./apps/desktop/scripts/fetch-whisper-bundle.sh [linux|windows|macos|all]
#
# Size tradeoff (approx):
#   ggml-base.en.bin  ~142 MB
#   Linux ubuntu x64  ~10 MB (tar.gz unpacked larger with .so libs)
#   Windows x64 zip   ~9 MB
#   macOS arm64 CLI   ~built from source in CI (no official prebuilt CLI archive;
#                     Metal library embedded so the binary is relocatable)
# Total installer delta ≈ 150–160 MB — accepted so first Record → Transcribe → SOAP
# works offline without a separate STT download.
#
# Artifacts are gitignored; CI runs this before `tauri build`.
#
# macOS note: whisper.cpp GitHub releases ship Linux/Windows CLI archives and an
# xcframework, but not a standalone macOS whisper-cli tarball. This script builds
# whisper-cli from the same WHISPER_BUNDLE_TAG source on Darwin (CI macos-latest
# → Apple Silicon / aarch64.dmg). Intel Mac is not a separate matrix target.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RES="$ROOT/src-tauri/resources/whisper"
PLATFORM="${1:-}"
WHISPER_TAG="${WHISPER_BUNDLE_TAG:-b5454}"
MODEL_URL="${WHISPER_MODEL_URL:-https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin}"
MODEL_NAME="ggml-base.en.bin"
GH_BASE="https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_TAG}"
WHISPER_REPO="${WHISPER_REPO_URL:-https://github.com/ggml-org/whisper.cpp.git}"

if [[ -z "$PLATFORM" ]]; then
  case "$(uname -s)" in
    Linux*) PLATFORM=linux ;;
    Darwin*) PLATFORM=macos ;;
    MINGW*|MSYS*|CYGWIN*|Windows_NT) PLATFORM=windows ;;
    *)
      echo "Pass linux, windows, macos, or all (got uname=$(uname -s))" >&2
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

# Official releases do not ship a macOS whisper-cli archive (only xcframework).
# Build a relocatable CLI from the release tag with Metal embedded in the binary.
build_macos() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "macos platform requires Darwin (got $(uname -s))" >&2
    exit 1
  fi
  if ! command -v cmake >/dev/null 2>&1; then
    echo "cmake is required to build whisper-cli on macOS" >&2
    exit 1
  fi
  if ! command -v git >/dev/null 2>&1; then
    echo "git is required to build whisper-cli on macOS" >&2
    exit 1
  fi

  local arch
  arch="$(uname -m)"
  # Normalize for folder name (Apple Silicon runners report arm64).
  local arch_dir="macos-${arch}"
  local out="$RES/tools/${arch_dir}"
  local src="$RES/tools/_whisper_src"
  local jobs
  jobs="$(sysctl -n hw.logicalcpu 2>/dev/null || echo 4)"

  echo "Building whisper-cli from ${WHISPER_REPO}@${WHISPER_TAG} for ${arch}…"
  rm -rf "$src" "$out"
  mkdir -p "$out"
  git clone --depth 1 --branch "$WHISPER_TAG" "$WHISPER_REPO" "$src"

  # Static libs + embedded Metal so whisper-cli relocates inside the .app bundle
  # without shipping separate .metallib / dylib neighbors.
  cmake -S "$src" -B "$src/build" \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_SHARED_LIBS=OFF \
    -DGGML_NATIVE=OFF \
    -DGGML_METAL=ON \
    -DGGML_METAL_EMBED_LIBRARY=ON \
    -DWHISPER_BUILD_TESTS=OFF \
    -DWHISPER_BUILD_SERVER=OFF \
    -DWHISPER_CURL=OFF
  cmake --build "$src/build" -j "$jobs" --config Release --target whisper-cli

  local cli=""
  for candidate in \
    "$src/build/bin/whisper-cli" \
    "$src/build/bin/Release/whisper-cli" \
    "$src/build/examples/cli/whisper-cli"
  do
    if [[ -f "$candidate" ]]; then
      cli="$candidate"
      break
    fi
  done
  if [[ -z "$cli" ]]; then
    cli="$(find "$src/build" -type f -name whisper-cli | head -n1 || true)"
  fi
  if [[ -z "$cli" || ! -f "$cli" ]]; then
    echo "whisper-cli missing after macOS build" >&2
    exit 1
  fi

  cp "$cli" "$out/whisper-cli"
  chmod +x "$out/whisper-cli"
  # Drop any companion shared libs if the build produced them beside the CLI.
  local bin_dir
  bin_dir="$(dirname "$cli")"
  find "$bin_dir" -maxdepth 1 \( -name '*.dylib' -o -name '*.so' \) -print0 2>/dev/null \
    | while IFS= read -r -d '' lib; do
        cp "$lib" "$out/"
      done

  rm -rf "$src"
  echo "macOS STT binary: $out/whisper-cli"
  # Smoke: binary exists and is executable; full --help may need codesign on some hosts.
  if [[ ! -x "$out/whisper-cli" ]]; then
    echo "macOS whisper-cli is not executable" >&2
    exit 1
  fi
}

case "$PLATFORM" in
  linux) unpack_linux ;;
  windows) unpack_windows ;;
  macos) build_macos ;;
  all)
    unpack_linux
    unpack_windows
    if [[ "$(uname -s)" == "Darwin" ]]; then
      build_macos
    else
      echo "Skipping macos build on $(uname -s) (all = linux+windows here)"
    fi
    ;;
  *)
    echo "Unknown platform: $PLATFORM (use linux|windows|macos|all)" >&2
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
