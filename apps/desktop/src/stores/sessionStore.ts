import { create } from 'zustand';
import type { DesktopSession, SOAPNote } from '@solopractice/shared';

interface SessionState {
  sessions: DesktopSession[];
  activeSession: DesktopSession | null;
  isRecording: boolean;

  // Actions
  setSessions: (sessions: DesktopSession[]) => void;
  addSession: (session: DesktopSession) => void;
  updateSession: (localId: number, updates: Partial<DesktopSession>) => void;
  setActiveSession: (session: DesktopSession | null) => void;
  setRecording: (recording: boolean) => void;

  // SOAP actions
  updateSOAPNote: (localId: number, soap: SOAPNote) => void;
  finalizeSOAPNote: (localId: number) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],
  activeSession: null,
  isRecording: false,

  setSessions: (sessions) => set({ sessions }),

  addSession: (session) =>
    set((state) => ({
      sessions: [...state.sessions, session],
    })),

  updateSession: (localId, updates) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.localId === localId ? { ...s, ...updates } : s)),
      activeSession:
        state.activeSession?.localId === localId
          ? { ...state.activeSession, ...updates }
          : state.activeSession,
    })),

  setActiveSession: (session) => set({ activeSession: session }),

  setRecording: (isRecording) => set({ isRecording }),

  updateSOAPNote: (localId, soap) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.localId === localId
          ? { ...s, soapNote: soap, soapStatus: soap.finalized ? 'finalized' : 'draft' }
          : s
      ),
    })),

  finalizeSOAPNote: (localId) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.localId === localId && s.soapNote
          ? {
              ...s,
              soapNote: { ...s.soapNote, finalized: true, finalizedAt: new Date().toISOString() },
              soapStatus: 'finalized',
            }
          : s
      ),
    })),
}));
