import { create } from 'zustand';
import type { DesktopClient, ConsentStatusFlags } from '@solopractice/shared';

interface ClientState {
  clients: DesktopClient[];
  selectedClientId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setClients: (clients: DesktopClient[]) => void;
  addClient: (client: DesktopClient) => void;
  updateClient: (id: string, updates: Partial<DesktopClient>) => void;
  updateConsentStatus: (id: string, consentStatus: ConsentStatusFlags) => void;
  selectClient: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useClientStore = create<ClientState>((set) => ({
  clients: [],
  selectedClientId: null,
  isLoading: false,
  error: null,

  setClients: (clients) => set({ clients }),

  addClient: (client) =>
    set((state) => ({
      clients: [...state.clients, client],
    })),

  updateClient: (id, updates) =>
    set((state) => ({
      clients: state.clients.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  updateConsentStatus: (id, consentStatus) =>
    set((state) => ({
      clients: state.clients.map((c) => (c.id === id ? { ...c, consentStatus } : c)),
    })),

  selectClient: (id) => set({ selectedClientId: id }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),
}));

/**
 * Check if a client has all required consents for recording.
 * Recording is BLOCKED unless recording consent is explicitly signed.
 */
export function canRecord(client: DesktopClient): boolean {
  return (
    client.consentStatus.informedConsent &&
    client.consentStatus.privacyNotice &&
    client.consentStatus.recordingConsent &&
    client.consentStatus.limitsOfConfidentiality
  );
}

/**
 * Check if a client is selectable (has minimum required consents).
 * Clients without basic consents are greyed out in the UI.
 */
export function isClientSelectable(client: DesktopClient): boolean {
  return (
    client.consentStatus.informedConsent &&
    client.consentStatus.privacyNotice &&
    client.consentStatus.limitsOfConfidentiality
  );
}
