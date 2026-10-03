import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface SettingsState {
  webApiUrl: string;
  apiKey: string | null;
  whisperModelSize: "tiny" | "base" | "small" | "medium" | "large";
  ollamaModel: string;
  autoBackup: boolean;
  backupPath: string;
}

interface SettingsProps {
  onReopenWizard: () => void;
}

export function Settings({ onReopenWizard }: SettingsProps) {
  const [settings, setSettings] = useState<SettingsState>({
    webApiUrl: "https://www.solopractice.io",
    apiKey: null,
    whisperModelSize: "base",
    ollamaModel: "llama3.2",
    autoBackup: true,
    backupPath: "",
  });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Load whatever was actually saved last time instead of trusting the
  // hardcoded defaults above forever. Before this, every remount of the
  // Settings page silently reset the visible webApiUrl/apiKey fields back
  // to their initial useState values even though save_settings had already
  // persisted the real ones to the settings table -- clicking Save again
  // after that would have overwritten the real saved key with blank/default
  // values without any error, since save_settings always succeeds.
  useEffect(() => {
    let cancelled = false;
    invoke<SettingsState>("get_settings")
      .then((loadedSettings) => {
        if (!cancelled) setSettings(loadedSettings);
      })
      .catch((error) => {
        console.error("Failed to load settings:", error);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveSettings() {
    setSaving(true);
    try {
      await invoke("save_settings", { settings });
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    try {
      const result = await invoke<boolean>("test_web_connection", {
        url: settings.webApiUrl,
      });
      alert(result ? "Connection successful!" : "Connection failed");
    } catch (error) {
      alert("Connection failed: " + error);
    }
  }

  async function syncNow() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const count = await invoke<number>("sync_clients");
      setSyncMessage({ text: `Synced ${count} client${count === 1 ? "" : "s"} from the web portal.`, isError: false });
    } catch (error) {
      setSyncMessage({ text: String(error), isError: true });
    } finally {
      setSyncing(false);
    }
  }

  async function generateSuperbillStub() {
    try {
      await invoke("generate_superbill_stub");
      alert("Superbill PDF generated (stub)");
    } catch (error) {
      alert("Superbill generation would happen here (stub)");
    }
  }

  async function openDataFolder() {
    setOpening(true);
    try {
      await invoke("reveal_data_folder");
    } catch (error) {
      alert("Couldn't open the folder: " + error);
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <header className="p-4 border-b border-border sticky top-0 bg-background">
        <h1 className="text-xl font-semibold">Settings</h1>
      </header>

      {!loaded && (
        <p className="px-4 pt-2 text-xs text-muted-foreground">Loading saved settings...</p>
      )}

      <div className="p-4 space-y-6 max-w-2xl">
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Getting started</h2>
          <p className="text-sm text-muted-foreground">
            Want to go through the welcome setup again -- for example, to connect your account,
            or to check your microphone?
          </p>
          <button
            onClick={onReopenWizard}
            className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors"
          >
            Run setup again
          </button>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">Your data</h2>
          <p className="text-sm text-muted-foreground">
            Recordings, transcripts, and notes are stored in a private folder on this computer
            only. Use this to make a backup copy.
          </p>
          <button
            onClick={openDataFolder}
            disabled={opening}
            className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent disabled:opacity-50"
          >
            {opening ? "Opening..." : "Open my data folder"}
          </button>
          <div className="flex items-center gap-3 pt-1">
            <input
              type="checkbox"
              id="autoBackup"
              checked={settings.autoBackup}
              onChange={(e) => setSettings({ ...settings, autoBackup: e.target.checked })}
              className="rounded border-border"
            />
            <label htmlFor="autoBackup" className="text-sm">
              Remind me to back up automatically
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">Superbill</h2>
          <button
            onClick={generateSuperbillStub}
            className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors"
          >
            Generate Sample Superbill PDF
          </button>
          <p className="text-xs text-muted-foreground">
            Superbills are generated locally with diagnosis and procedure codes. They never
            leave your device.
          </p>
        </section>

        <details className="group border border-border rounded-lg">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium select-none">
            Advanced settings
            <span className="text-muted-foreground font-normal ml-2">
              (only needed if something you set up manually isn't working)
            </span>
          </summary>
          <div className="px-4 pb-4 space-y-6 border-t border-border pt-4">
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Web Portal Connection</h3>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={settings.webApiUrl}
                  onChange={(e) => setSettings({ ...settings, webApiUrl: e.target.value })}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  onClick={testConnection}
                  className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors"
                >
                  Test
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Address of the SoloPractice web portal, used only to check consent status.
              </p>

              <label htmlFor="desktopApiKey" className="block text-xs font-medium text-muted-foreground pt-1">
                Connection code
              </label>
              <input
                id="desktopApiKey"
                type="password"
                autoComplete="off"
                value={settings.apiKey ?? ""}
                onChange={(e) => setSettings({ ...settings, apiKey: e.target.value || null })}
                placeholder="sp_desktop_..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-xs text-muted-foreground">
                Get this from your account at solopractice.io, under Settings &rarr; Desktop App,
                then paste it here.
              </p>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={syncNow}
                  disabled={syncing}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {syncing ? "Syncing..." : "Sync Now"}
                </button>
                {syncMessage && (
                  <p className={`text-xs ${syncMessage.isError ? "text-destructive" : "text-success"}`}>
                    {syncMessage.text}
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Pulls clients and consent status from the web portal now. This does not happen
                automatically in the background -- use this button whenever you want the latest
                list.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-medium">Transcription (whisper.cpp)</h3>
              <select
                value={settings.whisperModelSize}
                onChange={(e) =>
                  setSettings({ ...settings, whisperModelSize: e.target.value as SettingsState["whisperModelSize"] })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="tiny">Tiny (~75MB, fastest)</option>
                <option value="base">Base (~142MB, balanced, recommended)</option>
                <option value="small">Small (~466MB, better)</option>
                <option value="medium">Medium (~1.5GB, good)</option>
                <option value="large">Large (~2.9GB, best)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Larger models are more accurate but slower. Most people should leave this on Base.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-medium">AI note drafting (Ollama)</h3>
              <input
                type="text"
                value={settings.ollamaModel}
                onChange={(e) => setSettings({ ...settings, ollamaModel: e.target.value })}
                placeholder="llama3.2"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-xs text-muted-foreground">
                Ollama model name. Run the first-time setup again from Help if you need to
                reinstall this.
              </p>
            </div>
          </div>
        </details>

        <div className="pt-4 border-t border-border">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>

        <section className="p-4 bg-muted/50 rounded-lg space-y-2">
          <h3 className="font-medium text-sm">Data Security</h3>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• All clinical data is stored locally in an encrypted SQLite database</li>
            <li>• Audio recordings are saved only on your device</li>
            <li>• Transcripts and SOAP notes never leave your computer</li>
            <li>• Web sync is limited to client contact info and consent status flags</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
