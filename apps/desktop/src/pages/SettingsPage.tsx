import { useState } from 'react';

interface Settings {
  whisperModel: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  ollamaModel: string;
  recordingFormat: 'wav' | 'mp3';
  dataDirectory: string;
  autoBackup: boolean;
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    whisperModel: 'base',
    ollamaModel: 'llama3:8b',
    recordingFormat: 'wav',
    dataDirectory: 'C:\\Users\\therapist\\solopractice\\data',
    autoBackup: true,
  });

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // In real app, save to local config file
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Transcription (Whisper)</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Whisper Model
            </label>
            <select
              value={settings.whisperModel}
              onChange={(e) =>
                setSettings({ ...settings, whisperModel: e.target.value as Settings['whisperModel'] })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="tiny">Tiny (fastest, least accurate)</option>
              <option value="base">Base (balanced)</option>
              <option value="small">Small (better accuracy)</option>
              <option value="medium">Medium (high accuracy, slower)</option>
              <option value="large">Large (best accuracy, slowest)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Larger models are more accurate but require more memory and time.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">SOAP Generation (Ollama)</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ollama Model
            </label>
            <input
              type="text"
              value={settings.ollamaModel}
              onChange={(e) => setSettings({ ...settings, ollamaModel: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="e.g., llama3:8b, mistral:7b"
            />
            <p className="text-xs text-gray-500 mt-1">
              Make sure Ollama is running and the model is downloaded locally.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Recording</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recording Format
            </label>
            <select
              value={settings.recordingFormat}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  recordingFormat: e.target.value as Settings['recordingFormat'],
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="wav">WAV (uncompressed, best quality)</option>
              <option value="mp3">MP3 (compressed, smaller files)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Data Storage</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Directory
            </label>
            <input
              type="text"
              value={settings.dataDirectory}
              onChange={(e) => setSettings({ ...settings, dataDirectory: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              All clinical data (recordings, transcripts, SOAP notes) is stored here.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoBackup"
              checked={settings.autoBackup}
              onChange={(e) => setSettings({ ...settings, autoBackup: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="autoBackup" className="text-sm text-gray-700">
              Enable automatic encrypted backups
            </label>
          </div>
        </div>
      </div>

      <div className="clinical-warning">
        <strong>Security Reminder:</strong> All settings and data are stored locally. Clinical
        data never leaves this device. Ensure your Windows user account has a strong password
        and consider enabling BitLocker disk encryption.
      </div>

      <div className="flex gap-4">
        <button onClick={handleSave} className="btn-primary">
          Save Settings
        </button>
        {saved && <span className="text-green-600 self-center">✓ Saved</span>}
      </div>
    </div>
  );
}
