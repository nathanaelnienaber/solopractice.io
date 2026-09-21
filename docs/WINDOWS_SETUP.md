# Windows Setup Guide

This guide covers setting up the solopractice desktop app on Windows 10/11.

## Prerequisites

### 1. Install Node.js

Download and install Node.js 20 LTS from [nodejs.org](https://nodejs.org/).

Verify installation:
```powershell
node --version  # Should be 20.x or higher
```

### 2. Install pnpm

```powershell
npm install -g pnpm
pnpm --version  # Should be 9.x or higher
```

### 3. Install Rust

Download and run the Rust installer from [rustup.rs](https://rustup.rs/).

Choose the default installation. After installation:
```powershell
rustc --version
cargo --version
```

### 4. Install Visual Studio Build Tools

Tauri requires C++ build tools. Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with:
- "Desktop development with C++" workload
- Windows 10/11 SDK

### 5. Install WebView2

Windows 11 includes WebView2 by default. For Windows 10, download from [Microsoft](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

## Project Setup

```powershell
# Clone the repository
git clone https://github.com/yourorg/solopractice.git
cd solopractice

# Install dependencies
pnpm install

# Run the desktop app in development mode
pnpm dev:desktop
```

## Local AI Setup

### Whisper.cpp (Speech-to-Text)

1. Download whisper.cpp from [GitHub releases](https://github.com/ggerganov/whisper.cpp/releases)

2. Download a model (base recommended for balance of speed/quality):
   ```powershell
   # In whisper.cpp directory
   .\models\download-ggml-model.cmd base
   ```

3. Test transcription:
   ```powershell
   .\main.exe -m models\ggml-base.bin -f path\to\audio.wav
   ```

4. Configure the path in solopractice desktop settings.

**Model Size Guide:**
| Model | Size | Speed | Quality |
|-------|------|-------|---------|
| tiny | ~75MB | Fastest | Basic |
| base | ~142MB | Fast | Good |
| small | ~466MB | Moderate | Better |
| medium | ~1.5GB | Slow | High |
| large | ~2.9GB | Slowest | Best |

### Ollama (SOAP Generation)

1. Download Ollama from [ollama.com](https://ollama.com/download)

2. Install and start Ollama (runs as a background service)

3. Pull a model:
   ```powershell
   ollama pull llama3:8b
   ```

4. Test generation:
   ```powershell
   ollama run llama3:8b "Hello, how are you?"
   ```

5. Configure the model name in solopractice desktop settings.

**Recommended Models:**
- `llama3:8b` - Good balance of speed and quality
- `mistral:7b` - Fast, good for shorter notes
- `llama3:70b` - Best quality, requires significant RAM

## Data Storage

By default, solopractice stores data in:
```
C:\Users\<username>\AppData\Roaming\solopractice\
├── solopractice.db       # Encrypted SQLite database
├── recordings\           # Audio files
└── superbills\           # Generated PDF superbills
```

### Encryption

The SQLite database uses SQLCipher encryption. The encryption key is derived from your Windows user credentials and stored securely.

**Important:** Back up your data directory regularly. Clinical data is stored ONLY locally.

### Backup

1. Close the desktop app
2. Copy the entire data directory to a secure backup location
3. Consider using BitLocker or another encryption tool for backup drives

## Firewall Configuration

The desktop app does NOT require internet access for clinical features. However, the following connections are needed:

- **Consent sync**: HTTPS to your web app (outbound only)
- **Stripe/billing sync**: HTTPS to Stripe API (web app only)

You can run the desktop app completely offline for clinical work.

## Troubleshooting

### "Missing VCRUNTIME140.dll"

Install the [Visual C++ Redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe).

### Whisper is slow

- Use a smaller model (tiny or base)
- Ensure you have sufficient RAM (8GB+ recommended)
- Close other applications during transcription
- Consider GPU acceleration if you have an NVIDIA GPU

### Ollama won't start

1. Check if the Ollama service is running:
   ```powershell
   Get-Service ollama
   ```

2. Restart the service:
   ```powershell
   Restart-Service ollama
   ```

### Database locked error

Ensure only one instance of the desktop app is running. If the error persists, close the app and delete any `.db-journal` files in the data directory.

## Security Best Practices

1. **Use a strong Windows password** - Your data is as secure as your account
2. **Enable BitLocker** - Full disk encryption for your Windows drive
3. **Regular backups** - Back up to an encrypted external drive
4. **Keep Windows updated** - Security patches are important
5. **Don't share your user account** - Each therapist should have their own Windows account

## Support

For issues specific to the desktop app, check:
- The app's logs in `%APPDATA%\solopractice\logs\`
- GitHub Issues for known problems
- The product documentation for feature questions
