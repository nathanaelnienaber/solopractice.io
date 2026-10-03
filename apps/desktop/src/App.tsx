import { useState } from "react";
import { ClientList } from "./components/ClientList";
import { SessionPanel } from "./components/SessionPanel";
import { SessionHistory } from "./components/SessionHistory";
import { JobQueue } from "./components/JobQueue";
import { Settings } from "./components/Settings";
import { Help } from "./components/Help";
import { SetupWizard } from "./components/SetupWizard";
import type { SessionWithDetails } from "@solopractice/shared/desktop";

type View = "clients" | "session" | "history" | "jobs" | "settings" | "help";

const SETUP_DONE_KEY = "solopractice-setup-done";

export default function App() {
  const [view, setView] = useState<View>("clients");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string>("");
  const [currentSession, setCurrentSession] = useState<SessionWithDetails | null>(null);
  const [showWizard, setShowWizard] = useState(() => {
    try {
      return localStorage.getItem(SETUP_DONE_KEY) !== "true";
    } catch {
      return true;
    }
  });

  function dismissWizard() {
    try {
      localStorage.setItem(SETUP_DONE_KEY, "true");
    } catch {
      // Storage unavailable -- not fatal, wizard just reappears next launch.
    }
    setShowWizard(false);
  }

  return (
    <div className="flex h-screen bg-background">
      {showWizard && <SetupWizard onComplete={dismissWizard} onSkip={dismissWizard} />}
      {/* Sidebar */}
      <nav className="w-16 bg-muted border-r border-border flex flex-col items-center py-4 gap-2">
        <NavButton
          active={view === "clients"}
          onClick={() => setView("clients")}
          title="Clients"
        >
          <UsersIcon />
        </NavButton>
        <NavButton
          active={view === "session"}
          onClick={() => setView("session")}
          title="Session"
          disabled={!selectedClientId}
        >
          <MicIcon />
        </NavButton>
        <NavButton
          active={view === "history"}
          onClick={() => setView("history")}
          title="Session History"
          disabled={!selectedClientId}
        >
          <HistoryIcon />
        </NavButton>
        <NavButton
          active={view === "jobs"}
          onClick={() => setView("jobs")}
          title="Background Jobs"
        >
          <QueueIcon />
        </NavButton>
        <div className="flex-1" />
        <NavButton
          active={view === "help"}
          onClick={() => setView("help")}
          title="Help"
        >
          <HelpIcon />
        </NavButton>
        <NavButton
          active={view === "settings"}
          onClick={() => setView("settings")}
          title="Settings"
        >
          <SettingsIcon />
        </NavButton>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {view === "clients" && (
          <ClientList
            selectedClientId={selectedClientId}
            onSelectClient={(id, name) => {
              setSelectedClientId(id);
              setSelectedClientName(name);
              setView("session");
            }}
            onViewHistory={(id, name) => {
              setSelectedClientId(id);
              setSelectedClientName(name);
              setView("history");
            }}
          />
        )}
        {view === "session" && (
          <SessionPanel
            clientId={selectedClientId}
            session={currentSession}
            onSessionChange={setCurrentSession}
            onBack={() => setView("clients")}
            onViewHistory={() => setView("history")}
          />
        )}
        {view === "history" && selectedClientId && (
          <SessionHistory
            clientId={selectedClientId}
            clientName={selectedClientName}
            onClose={() => setView("clients")}
            onStartNewSession={() => setView("session")}
          />
        )}
        {view === "jobs" && <JobQueue />}
        {view === "help" && <Help />}
        {view === "settings" && <Settings />}
      </main>
    </div>
  );
}

function NavButton({
  children,
  active,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        w-10 h-10 rounded-lg flex items-center justify-center transition-colors
        ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      {children}
    </button>
  );
}

function UsersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function QueueIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45 1.043-1.45 1.887v.394M12 17.5h.008M12 21a9 9 0 100-18 9 9 0 000 18z"
      />
    </svg>
  );
}
