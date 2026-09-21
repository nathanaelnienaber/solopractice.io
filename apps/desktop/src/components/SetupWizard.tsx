import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface MlSetupStatus {
  whisperInstalled: boolean;
  whisperPath: string | null;
  whisperVersion: string | null;
  ollamaInstalled: boolean;
  ollamaPath: string | null;
  ollamaRunning: boolean;
  ollamaModels: string[];
  recommendedModel: string;
}

interface SetupWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function SetupWizard({ onComplete, onSkip }: SetupWizardProps) {
  const [step, setStep] = useState<"detecting" | "whisper" | "ollama" | "complete">("detecting");
  const [status, setStatus] = useState<MlSetupStatus | null>(null);
  const [whisperPath, setWhisperPath] = useState("");
  const [ollamaModel, setOllamaModel] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    detectSetup();
  }, []);

  async function detectSetup() {
    try {
      const result = await invoke<MlSetupStatus>("detect_ml_setup");
      setStatus(result);
      setWhisperPath(result.whisperPath || "");
      setOllamaModel(result.recommendedModel || "llama3.2");
      
      if (result.whisperInstalled && result.ollamaInstalled && result.ollamaRunning) {
        setStep("complete");
      } else if (!result.whisperInstalled) {
        setStep("whisper");
      } else {
        setStep("ollama");
      }
    } catch (err) {
      setError(String(err));
      setStep("whisper");
    }
  }

  async function testWhisper() {
    if (!whisperPath) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await invoke<string>("test_whisper", { whisperPath });
      setTestResult({ success: true, message: result });
    } catch (err) {
      setTestResult({ success: false, message: String(err) });
    }
    setTesting(false);
  }

  async function testOllama() {
    if (!ollamaModel) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await invoke<string>("test_ollama", { model: ollamaModel });
      setTestResult({ success: true, message: result });
    } catch (err) {
      setTestResult({ success: false, message: String(err) });
    }
    setTesting(false);
  }

  async function saveAndContinue() {
    try {
      await invoke("save_ml_paths", {
        whisperPath: whisperPath || null,
        ollamaModel: ollamaModel || null,
      });
      
      if (step === "whisper") {
        setStep("ollama");
        setTestResult(null);
      } else {
        setStep("complete");
      }
    } catch (err) {
      setError(String(err));
    }
  }

  async function browseForWhisper() {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      filters: [{ name: "Executable", extensions: ["exe"] }],
      title: "Select whisper.cpp main.exe",
    });
    if (selected) {
      setWhisperPath(selected as string);
      setTestResult(null);
    }
  }

  if (step === "detecting") {
    return (
      <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg">Detecting AI tools...</p>
          <p className="text-sm text-muted-foreground mt-1">Checking for whisper.cpp and Ollama</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border rounded-xl shadow-xl max-w-lg w-full p-6">
        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div className={`w-3 h-3 rounded-full ${step === "whisper" ? "bg-primary" : "bg-muted"}`} />
          <div className="flex-1 h-0.5 bg-muted">
            <div className={`h-full bg-primary transition-all ${step === "ollama" || step === "complete" ? "w-full" : "w-0"}`} />
          </div>
          <div className={`w-3 h-3 rounded-full ${step === "ollama" ? "bg-primary" : step === "complete" ? "bg-green-500" : "bg-muted"}`} />
          <div className="flex-1 h-0.5 bg-muted">
            <div className={`h-full bg-primary transition-all ${step === "complete" ? "w-full" : "w-0"}`} />
          </div>
          <div className={`w-3 h-3 rounded-full ${step === "complete" ? "bg-green-500" : "bg-muted"}`} />
        </div>

        {step === "whisper" && (
          <>
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold">Set Up Transcription</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  whisper.cpp converts your session recordings into text transcripts. It runs entirely on your computer.
                </p>
              </div>
            </div>

            {status?.whisperInstalled ? (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4">
                <p className="text-green-800 dark:text-green-200 text-sm font-medium">
                  ✓ whisper.cpp detected at: {status.whisperPath}
                </p>
              </div>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
                <p className="text-amber-800 dark:text-amber-200 text-sm font-medium mb-2">
                  whisper.cpp not detected
                </p>
                <ol className="text-amber-700 dark:text-amber-300 text-sm space-y-1 list-decimal list-inside">
                  <li>Download from <a href="https://github.com/ggerganov/whisper.cpp/releases" target="_blank" className="underline">github.com/ggerganov/whisper.cpp</a></li>
                  <li>Extract to a folder (e.g., C:\whisper)</li>
                  <li>Download a model (e.g., ggml-base.en.bin)</li>
                  <li>Select the main.exe file below</li>
                </ol>
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-sm font-medium">Path to whisper.cpp (main.exe)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={whisperPath}
                  onChange={(e) => setWhisperPath(e.target.value)}
                  placeholder="C:\whisper\main.exe"
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <button
                  onClick={browseForWhisper}
                  className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-accent"
                >
                  Browse
                </button>
              </div>
            </div>

            {whisperPath && (
              <div className="mt-4">
                <button
                  onClick={testWhisper}
                  disabled={testing}
                  className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent disabled:opacity-50"
                >
                  {testing ? "Testing..." : "Test Whisper"}
                </button>
                {testResult && (
                  <p className={`text-sm mt-2 ${testResult.success ? "text-green-600" : "text-red-600"}`}>
                    {testResult.message}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {step === "ollama" && (
          <>
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold">Set Up AI Notes</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Ollama generates SOAP note drafts from your transcripts using local AI. No data leaves your computer.
                </p>
              </div>
            </div>

            {status?.ollamaInstalled && status?.ollamaRunning ? (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4">
                <p className="text-green-800 dark:text-green-200 text-sm font-medium">
                  ✓ Ollama is running with {status.ollamaModels.length} model(s) available
                </p>
              </div>
            ) : status?.ollamaInstalled ? (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
                <p className="text-amber-800 dark:text-amber-200 text-sm font-medium mb-2">
                  Ollama is installed but not running
                </p>
                <p className="text-amber-700 dark:text-amber-300 text-sm">
                  Start Ollama from your Start menu or run <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">ollama serve</code> in a terminal.
                </p>
              </div>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
                <p className="text-amber-800 dark:text-amber-200 text-sm font-medium mb-2">
                  Ollama not detected
                </p>
                <ol className="text-amber-700 dark:text-amber-300 text-sm space-y-1 list-decimal list-inside">
                  <li>Download from <a href="https://ollama.com/download" target="_blank" className="underline">ollama.com/download</a></li>
                  <li>Install and run Ollama</li>
                  <li>Pull a model: <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">ollama pull llama3.2</code></li>
                </ol>
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-sm font-medium">AI Model for SOAP Notes</label>
              {status?.ollamaModels && status.ollamaModels.length > 0 ? (
                <select
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  {status.ollamaModels.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  placeholder="llama3.2"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              )}
              <p className="text-xs text-muted-foreground">
                Recommended: llama3.2 (fast, good quality). Use llama3.2:70b for best quality if you have 64GB+ RAM.
              </p>
            </div>

            {ollamaModel && status?.ollamaRunning && (
              <div className="mt-4">
                <button
                  onClick={testOllama}
                  disabled={testing}
                  className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent disabled:opacity-50"
                >
                  {testing ? "Testing..." : "Test Ollama"}
                </button>
                {testResult && (
                  <p className={`text-sm mt-2 ${testResult.success ? "text-green-600" : "text-red-600"}`}>
                    {testResult.message}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {step === "complete" && (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">Setup Complete!</h2>
            <p className="text-muted-foreground text-sm mb-4">
              Your AI tools are configured and ready to use. Recordings will be automatically transcribed and SOAP drafts generated.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 text-left text-sm space-y-2">
              <p>
                <span className="font-medium">Transcription:</span>{" "}
                {status?.whisperInstalled ? "✓ Configured" : "○ Using mock (configure in Settings)"}
              </p>
              <p>
                <span className="font-medium">SOAP Generation:</span>{" "}
                {status?.ollamaRunning ? `✓ ${ollamaModel}` : "○ Using mock (configure in Settings)"}
              </p>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 mt-4">{error}</p>
        )}

        <div className="flex justify-between mt-6 pt-4 border-t">
          <button
            onClick={onSkip}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Skip Setup
          </button>
          
          {step === "complete" ? (
            <button
              onClick={onComplete}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90"
            >
              Get Started
            </button>
          ) : (
            <button
              onClick={saveAndContinue}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90"
            >
              {step === "whisper" ? "Next: AI Notes" : "Finish Setup"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
