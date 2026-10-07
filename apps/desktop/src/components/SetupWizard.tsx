import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  acquireAudioStream,
  classifyMicFailure,
  micFailureUserMessage,
  type MicFailureKind,
} from "../lib/audioCapture";
import {
  ActionRow,
  Banner,
  Button,
  Input,
} from "./ui";

interface MlSetupStatus {
  whisperModelDownloaded: boolean;
  whisperModelPath: string | null;
  whisperBinaryAvailable: boolean;
  whisperBinaryPath: string | null;
  whisperBinaryDownloadSupported: boolean;
  ollamaInstalled: boolean;
  ollamaRunning: boolean;
  ollamaModels: string[];
  recommendedModel: string;
  recommendedWhisperModel: string;
}

interface DownloadProgress {
  kind: "whisper-model" | "whisper-binary" | "ollama-model";
  label: string;
  downloadedBytes: number;
  totalBytes: number | null;
  percent: number | null;
  attempt: number;
  done: boolean;
  error: string | null;
}

type Step = "connectAccount" | "welcome" | "dataLocation" | "microphone" | "speechToText" | "aiDrafting" | "done";

const STEP_ORDER: Step[] = ["connectAccount", "welcome", "dataLocation", "microphone", "speechToText", "aiDrafting", "done"];

interface SetupWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function SetupWizard({ onComplete, onSkip }: SetupWizardProps) {
  const [step, setStep] = useState<Step>("connectAccount");
  const [status, setStatus] = useState<MlSetupStatus | null>(null);
  const [micState, setMicState] = useState<"unchecked" | "checking" | "ok" | "failed">("unchecked");
  const [micFailureKind, setMicFailureKind] = useState<MicFailureKind | null>(null);
  const [micFailureDetail, setMicFailureDetail] = useState<string | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Connection code / account pairing state. Kept separate from the
  // Settings.tsx copy of the same idea -- this step writes directly via
  // save_settings + sync_clients (the same real commands Settings.tsx
  // uses), it does not duplicate any business logic, just gives it a
  // home at the START of first launch instead of being buried three
  // clicks deep under Settings -> Advanced settings, which a new user
  // has no reason to ever find on their own.
  const [hasAccount, setHasAccount] = useState<"unknown" | "yes" | "no">("unknown");
  const [connectionCode, setConnectionCode] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectResult, setConnectResult] = useState<{ text: string; isError: boolean } | null>(
    null
  );
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    invoke<MlSetupStatus>("detect_ml_setup")
      .then(setStatus)
      .catch(() => setStatus(null));

    const unlisten = listen<DownloadProgress>("ml-download-progress", (event) => {
      setProgress(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  function goTo(next: Step) {
    setMessage(null);
    setProgress(null);
    setStep(next);
  }

  function nextStep() {
    const idx = STEP_ORDER.indexOf(step);
    const next = STEP_ORDER[Math.min(idx + 1, STEP_ORDER.length - 1)] ?? "done";
    goTo(next);
  }

  async function checkMicrophone() {
    setMicState("checking");
    setMicFailureKind(null);
    setMicFailureDetail(null);
    try {
      // Same ladder as Start Recording — never soft-fail a constraint bug as
      // "permission denied". Uses preferred → soft → `{ audio: true }`.
      const stream = await acquireAudioStream();
      stream.getTracks().forEach((track) => track.stop());
      setMicState("ok");
    } catch (err) {
      console.error("[SetupWizard] microphone check failed:", err);
      const kind = classifyMicFailure(err);
      setMicFailureKind(kind);
      setMicFailureDetail(micFailureUserMessage(kind, err));
      setMicState("failed");
    }
  }

  function openWebPortal(path: string) {
    import("@tauri-apps/plugin-shell").then(({ open }) =>
      open(`https://www.solopractice.io${path}`)
    );
  }

  async function connectToAccount() {
    const code = connectionCode.trim();
    if (!code) return;
    setConnecting(true);
    setConnectResult(null);
    try {
      // Reuses the same real settings table + sync pipeline as
      // Settings.tsx's Advanced settings section -- this step is just a
      // friendlier front door onto it, not a separate mechanism. Reads
      // the current settings first so webApiUrl (already defaulted to
      // the real production portal by get_settings on the Rust side)
      // isn't clobbered.
      const current = await invoke<{
        webApiUrl: string;
        apiKey: string | null;
        whisperModelSize: "tiny" | "base" | "small" | "medium" | "large";
        ollamaModel: string;
        autoBackup: boolean;
        backupPath: string;
      }>("get_settings");
      await invoke("save_settings", { settings: { ...current, apiKey: code } });
      const count = await invoke<number>("sync_clients");
      setConnectResult({
        text: `Connected -- found ${count} client${count === 1 ? "" : "s"}.`,
        isError: false,
      });
      setConnected(true);
    } catch (error) {
      setConnectResult({ text: String(error), isError: true });
    } finally {
      setConnecting(false);
    }
  }

  async function setUpSpeechToText() {
    setWorking(true);
    setMessage(null);
    try {
      // One command: model + Linux/Windows binary, persist paths, refresh detect.
      const refreshed = await invoke<MlSetupStatus>("setup_speech_to_text", {
        model: status?.recommendedWhisperModel ?? "ggml-base.en",
      });
      setStatus(refreshed);
      if (!refreshed.whisperBinaryAvailable) {
        setMessage(
          refreshed.whisperBinaryDownloadSupported
            ? "The model downloaded, but the speech-to-text program did not. Try again, or write notes by hand for now."
            : "The model is ready, but automatic program download isn't available on this OS yet. You can still write session notes by hand."
        );
      } else if (refreshed.whisperModelDownloaded) {
        setMessage("Speech-to-text is ready. Continue to the next step, or skip AI drafting.");
      }
    } catch (err) {
      setMessage(
        "We couldn't finish setting up speech-to-text automatically. You can skip this for now and write session notes by hand, then try again later from Settings or the SOAP status panel."
      );
      console.error(err);
    } finally {
      setWorking(false);
    }
  }

  async function setUpAiDrafting() {
    setWorking(true);
    setMessage(null);
    try {
      await invoke("pull_ollama_model", { model: status?.recommendedModel ?? "llama3.2" });
      await invoke("save_ml_paths", {
        whisperPath: null,
        whisperModelPath: null,
        ollamaModel: status?.recommendedModel ?? "llama3.2",
      });
      const refreshed = await invoke<MlSetupStatus>("detect_ml_setup");
      setStatus(refreshed);
    } catch (err) {
      setMessage(
        "We couldn't set up AI drafting automatically. That's okay, you can still write your session notes yourself, and set this up later from Settings."
      );
      console.error(err);
    } finally {
      setWorking(false);
    }
  }

  const progressPct = progress?.percent != null ? Math.round(progress.percent) : null;

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border rounded-xl shadow-xl max-w-lg w-full p-6">
        <WizardProgress step={step} />

        {step === "connectAccount" && (
          <Section
            title="Connect your account"
            body="If you already have a SoloPractice account on the web, connect this computer to it so your client list stays in sync. This is optional -- you can skip it and add clients by hand instead."
          >
            {connected ? (
              <Banner tone="success">{connectResult?.text}</Banner>
            ) : hasAccount === "unknown" ? (
              <div className="flex gap-2">
                <Button onClick={() => setHasAccount("yes")}>
                  Yes, I have an account
                </Button>
                <Button variant="outline" onClick={() => setHasAccount("no")}>
                  Not yet
                </Button>
              </div>
            ) : hasAccount === "no" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Create your free account in your browser, then come back here and pick
                  &ldquo;Yes, I have an account&rdquo;.
                </p>
                <Button onClick={() => openWebPortal("/therapist/login")}>
                  Create my account
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Input
                  type="password"
                  autoComplete="off"
                  value={connectionCode}
                  onChange={(e) => setConnectionCode(e.target.value)}
                  placeholder="Paste your connection code"
                />
                <ActionRow>
                  <Button
                    onClick={connectToAccount}
                    disabled={connecting || !connectionCode.trim()}
                    loading={connecting}
                  >
                    {connecting ? "Connecting…" : "Connect"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openWebPortal("/therapist/settings#desktop")}
                  >
                    Don&rsquo;t have a code? Get one from your account
                  </Button>
                </ActionRow>
                {connectResult && (
                  <Banner tone={connectResult.isError ? "warning" : "success"}>
                    {connectResult.text}
                  </Banner>
                )}
              </div>
            )}
          </Section>
        )}

        {step === "welcome" && (
          <Section
            title="Welcome to SoloPractice"
            body="Let's get your computer set up. This will take about two minutes, and you won't need to type anything technical."
          >
            <p className="text-sm text-muted-foreground">
              SoloPractice helps you record sessions, write notes, and get paid, all from one
              simple app. Everything about your clients' care stays on this computer. Nothing
              clinical is ever sent anywhere else.
            </p>
          </Section>
        )}

        {step === "dataLocation" && (
          <Section
            title="Where your information is kept"
            body="Everything you record or write is saved in a private folder on this computer that only you can open."
          >
            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
              <p>• Session recordings, transcripts, and notes never leave this computer.</p>
              <p>• We never upload them to the internet, and nobody at SoloPractice can see them.</p>
              <p>
                • You can open that private folder any time from Help, to make your own backup
                copy.
              </p>
            </div>
          </Section>
        )}

        {step === "microphone" && (
          <Section
            title="Check your microphone"
            body="SoloPractice needs permission to hear your microphone so it can record sessions."
          >
            {(micState === "unchecked" || micState === "failed") && (
              <Button onClick={checkMicrophone}>
                {micState === "failed" ? "Try microphone again" : "Test my microphone"}
              </Button>
            )}
            {micState === "checking" && <p className="text-sm text-muted-foreground">Checking...</p>}
            {micState === "ok" && (
              <Banner tone="success">Your microphone is working.</Banner>
            )}
            {micState === "failed" && micFailureDetail && (
              <div className="space-y-2 mt-3">
                <Banner tone="warning">{micFailureDetail}</Banner>
                {micFailureKind === "permission" ? (
                  <p className="text-xs text-muted-foreground">
                    On Linux, allow SoloPractice in your system privacy / PipeWire portal prompt,
                    then try again. You can also re-run this check later from Settings.
                  </p>
                ) : micFailureKind === "not_found" || micFailureKind === "unavailable" ? (
                  <p className="text-xs text-muted-foreground">
                    Confirm a mic is connected and not exclusively used by another app. On Arch /
                    Omarchy, ensure PipeWire (or PulseAudio) is running. You can still type notes
                    without recording.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    You can still use SoloPractice without recording by typing notes directly.
                    Re-run setup from Settings after updating the app if this persists.
                  </p>
                )}
              </div>
            )}
          </Section>
        )}

        {step === "speechToText" && (
          <Section
            title="Turn recordings into text"
            body="This is optional. SoloPractice can automatically turn your session recordings into a written transcript, entirely on this computer, using nothing sent over the internet. The AppImage does not include these files — download them once into this computer's data folder."
          >
            {status?.whisperModelDownloaded && status?.whisperBinaryAvailable ? (
              <Banner tone="success">
                Speech-to-text is ready on this computer (program + model).
              </Banner>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-3">
                  Click below and SoloPractice will download the speech-to-text program and model,
                  just once. On Linux (including Omarchy) this uses the official ubuntu build from
                  whisper.cpp — no terminal install needed.
                </p>
                {status?.whisperModelDownloaded && !status?.whisperBinaryAvailable && (
                  <Banner tone="warning">
                    The model file is present, but the speech-to-text program is still missing.
                    Click below to finish setup.
                  </Banner>
                )}
                <Button onClick={setUpSpeechToText} loading={working}>
                  {working
                    ? "Downloading…"
                    : status?.whisperModelDownloaded
                      ? "Finish speech-to-text setup"
                      : "Set up speech-to-text"}
                </Button>
              </>
            )}
            {progress && progress.kind !== "ollama-model" && (
              <ProgressBar label={progress.label} percent={progressPct} error={progress.error} />
            )}
            {message && <p className="text-sm mt-3 text-muted-foreground">{message}</p>}
            <p className="text-xs text-muted-foreground mt-4">
              You can skip this. You&apos;ll still be able to write session notes by hand at any
              time. If you skip, Session → SOAP will offer Download speech-to-text later.
            </p>
          </Section>
        )}

        {step === "aiDrafting" && (
          <Section
            title="Get a first draft of your notes"
            body="Also optional. SoloPractice can write a first draft of your session notes for you to review and edit, using AI that runs only on this computer."
          >
            {status?.ollamaRunning ? (
              <Banner tone="success">
                AI drafting is ready to go ({status.ollamaModels.length} model
                {status.ollamaModels.length === 1 ? "" : "s"} installed).
              </Banner>
            ) : status?.ollamaInstalled ? (
              <>
                <p className="text-sm text-muted-foreground mb-3">
                  We found the AI drafting program on your computer, but it isn't turned on. Open
                  it, then come back here.
                </p>
                <Button onClick={setUpAiDrafting} loading={working}>
                  {working ? "Setting up…" : "Try again"}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-3">
                  This needs a free helper program called Ollama installed first. If you'd rather
                  skip this step, you'll still write your notes yourself, exactly as before.
                </p>
                <ActionRow>
                  <Button
                    variant="outline"
                    onClick={() =>
                      import("@tauri-apps/plugin-shell").then(({ open }) => open("https://ollama.com/download"))
                    }
                  >
                    Get the AI drafting program
                  </Button>
                  <Button onClick={setUpAiDrafting} loading={working}>
                    {working ? "Setting up…" : "I installed it, continue"}
                  </Button>
                </ActionRow>
              </>
            )}
            {progress && progress.kind === "ollama-model" && (
              <ProgressBar label={progress.label} percent={progressPct} error={progress.error} />
            )}
            {message && <p className="text-sm mt-3 text-muted-foreground">{message}</p>}
            <p className="text-xs text-muted-foreground mt-4">
              Every AI draft is clearly marked and you always review and edit it before saving.
              Skipping this step never stops you from writing and saving notes yourself.
            </p>
          </Section>
        )}

        {step === "done" && (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircleIcon />
            </div>
            <h2 className="text-xl font-semibold mb-2">You're all set</h2>
            <p className="text-muted-foreground text-sm mb-4">
              You can change any of this later from Settings or Help. Nothing here is permanent.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 text-left text-sm space-y-2">
              <p>
                <span className="font-medium">Speech-to-text:</span>{" "}
                {status?.whisperModelDownloaded && status?.whisperBinaryAvailable
                  ? "Ready"
                  : "Not set up yet — write notes by hand, or download from Session → SOAP / Settings → Run setup again"}
              </p>
              <p>
                <span className="font-medium">AI drafting:</span>{" "}
                {status?.ollamaRunning ? "Ready" : "Not set up yet, write notes by hand for now"}
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-6 pt-4 border-t border-border">
          <Button variant="ghost" onClick={onSkip}>
            Skip for now
          </Button>

          {step === "done" ? (
            <Button onClick={onComplete}>
              Start using SoloPractice
            </Button>
          ) : (
            <Button onClick={nextStep}>
              Continue
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function WizardProgress({ step }: { step: Step }) {
  const idx = STEP_ORDER.indexOf(step);
  return (
    <div className="flex items-center gap-1.5 mb-6">
      {STEP_ORDER.map((s, i) => (
        <div
          key={s}
          className={`h-1.5 flex-1 rounded-full ${i <= idx ? "bg-primary" : "bg-muted"}`}
        />
      ))}
    </div>
  );
}

function Section({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-2">
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-muted-foreground text-sm mb-4">{body}</p>
      {children}
    </div>
  );
}


function ProgressBar({
  label,
  percent,
  error,
}: {
  label: string;
  percent: number | null;
  error: string | null;
}) {
  return (
    <div className="mt-3">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: percent != null ? `${percent}%` : "20%" }}
        />
      </div>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
