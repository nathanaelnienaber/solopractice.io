import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ActionRow,
  Button,
  Field,
  Input,
  Label,
  PageBody,
  PageHeader,
  PageSection,
  PageShell,
  Select,
  Surface,
} from "./ui";

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
  const [syncMessage, setSyncMessage] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

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
      setSyncMessage({
        text: `Synced ${count} client${count === 1 ? "" : "s"} from the web portal.`,
        isError: false,
      });
    } catch (error) {
      setSyncMessage({ text: String(error), isError: true });
    } finally {
      setSyncing(false);
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
    <PageShell>
      <PageHeader title="Settings" sticky />

      {!loaded && (
        <p className="px-4 pt-2 text-xs text-muted-foreground">
          Loading saved settings…
        </p>
      )}

      <PageBody className="max-w-2xl mx-auto w-full space-y-6">
        <PageSection
          title="Getting started"
          description="Want to go through the welcome setup again — for example, to connect your account, or to check your microphone?"
        >
          <Button variant="outline" onClick={onReopenWizard}>
            Run setup again
          </Button>
        </PageSection>

        <PageSection
          title="Your data"
          description="Recordings, transcripts, and notes are stored in a private folder on this computer only. Use this to make a backup copy."
        >
          <ActionRow>
            <Button
              variant="outline"
              onClick={openDataFolder}
              loading={opening}
            >
              {opening ? "Opening…" : "Open my data folder"}
            </Button>
          </ActionRow>
          <div className="flex items-center gap-3 pt-1">
            <input
              type="checkbox"
              id="autoBackup"
              checked={settings.autoBackup}
              onChange={(e) =>
                setSettings({ ...settings, autoBackup: e.target.checked })
              }
              className="rounded border-border"
            />
            <Label htmlFor="autoBackup" className="mb-0 font-normal">
              Remind me to back up automatically
            </Label>
          </div>
        </PageSection>

        <PageSection
          title="Superbill"
          description="Use Superbill in the left sidebar to create a PDF with diagnosis and procedure codes, or fulfill client requests under Pending. Superbills stay on this computer and are never synced to the web."
        />

        <details className="group border border-border rounded-lg">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium select-none">
            Advanced settings
            <span className="text-muted-foreground font-normal ml-2">
              (only needed if something you set up manually isn&apos;t working)
            </span>
          </summary>
          <div className="px-4 pb-4 space-y-6 border-t border-border pt-4">
            <PageSection title="Web portal connection">
              <Field hint="Address of the SoloPractice web portal, used only to check consent status.">
                <ActionRow>
                  <Input
                    type="url"
                    value={settings.webApiUrl}
                    onChange={(e) =>
                      setSettings({ ...settings, webApiUrl: e.target.value })
                    }
                    className="flex-1 min-w-[12rem]"
                  />
                  <Button variant="outline" onClick={testConnection}>
                    Test
                  </Button>
                </ActionRow>
              </Field>

              <Field
                label="Connection code"
                htmlFor="desktopApiKey"
                hint="Get this from your account at solopractice.io, under Settings → Desktop App, then paste it here."
              >
                <Input
                  id="desktopApiKey"
                  type="password"
                  autoComplete="off"
                  value={settings.apiKey ?? ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      apiKey: e.target.value || null,
                    })
                  }
                  placeholder="sp_desktop_..."
                />
              </Field>

              <ActionRow>
                <Button onClick={syncNow} loading={syncing}>
                  {syncing ? "Syncing…" : "Sync now"}
                </Button>
                {syncMessage && (
                  <p
                    className={`text-xs ${
                      syncMessage.isError ? "text-destructive" : "text-success"
                    }`}
                  >
                    {syncMessage.text}
                  </p>
                )}
              </ActionRow>
              <p className="text-xs text-muted-foreground">
                Pulls clients and consent status from the web portal now. This
                does not happen automatically in the background — use this
                button whenever you want the latest list.
              </p>
            </PageSection>

            <Field
              label="Transcription (whisper.cpp)"
              hint="Larger models are more accurate but slower. Most people should leave this on Base."
            >
              <Select
                value={settings.whisperModelSize}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    whisperModelSize: e.target
                      .value as SettingsState["whisperModelSize"],
                  })
                }
              >
                <option value="tiny">Tiny (~75MB, fastest)</option>
                <option value="base">Base (~142MB, balanced, recommended)</option>
                <option value="small">Small (~466MB, better)</option>
                <option value="medium">Medium (~1.5GB, good)</option>
                <option value="large">Large (~2.9GB, best)</option>
              </Select>
            </Field>

            <Field
              label="AI note drafting (Ollama)"
              hint="Ollama model name. Run the first-time setup again if you need to reinstall this."
            >
              <Input
                type="text"
                value={settings.ollamaModel}
                onChange={(e) =>
                  setSettings({ ...settings, ollamaModel: e.target.value })
                }
                placeholder="llama3.2"
              />
            </Field>
          </div>
        </details>

        <div className="pt-2 border-t border-border">
          <Button onClick={saveSettings} loading={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>

        <Surface className="bg-muted/50 p-4 space-y-2">
          <h3 className="font-medium text-sm">Data security</h3>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>
              • Clinical data is stored locally on this computer (the app does
              not encrypt the database yet — use full-disk encryption such as
              BitLocker)
            </li>
            <li>• Audio recordings are saved only on your device</li>
            <li>• Transcripts and SOAP notes never leave your computer</li>
            <li>
              • Web sync is limited to client contact info and consent status
              (not session notes)
            </li>
          </ul>
        </Surface>
      </PageBody>
    </PageShell>
  );
}
