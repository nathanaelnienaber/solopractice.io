import { createContext, useContext, useEffect, useState } from "react";

export type Language = "en" | "es" | "de" | "sv";

export const LANGUAGES: { code: Language; name: string; flag: string }[] = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "sv", name: "Svenska", flag: "🇸🇪" },
];

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    "nav.clients": "Clients",
    "nav.session": "Record Session",
    "nav.jobs": "Background Jobs",
    "nav.settings": "Settings",

    // Clients
    "clients.title": "Clients",
    "clients.search": "Search clients...",
    "clients.noClients": "No clients yet",
    "clients.noClientsDesc": "Add clients through the web portal first.",
    "clients.consentComplete": "Ready to record",
    "clients.consentPending": "Consent forms pending",
    "clients.syncConsent": "Check consent status",

    // Session Recording
    "session.title": "Record Session",
    "session.selectClient": "Select a Client",
    "session.selectClientDesc": "Choose a client from the list to start recording.",
    "session.ready": "Ready to Record",
    "session.readyDesc": "Click the button below to start recording. Audio stays on this computer.",
    "session.start": "Start Recording",
    "session.stop": "Stop Recording",
    "session.recording": "Recording...",
    "session.recordingDesc": "Session in progress. Click stop when finished.",
    "session.processing": "Processing...",
    "session.transcribing": "Creating transcript...",
    "session.drafting": "Writing notes draft...",
    "session.draftReady": "Draft Ready",
    "session.draftReadyDesc": "Review and edit your session notes below.",
    "session.saveNotes": "Save Notes",
    "session.notesSaved": "Notes saved",

    // SOAP Editor
    "soap.title": "Session Notes",
    "soap.aiDraft": "AI-generated draft — please review carefully",
    "soap.subjective": "What the client shared",
    "soap.objective": "What you observed",
    "soap.assessment": "Your assessment",
    "soap.plan": "Next steps",

    // Jobs
    "jobs.title": "Background Jobs",
    "jobs.pipeline": "Processing Pipeline",
    "jobs.audioSaved": "Audio Saved",
    "jobs.transcribing": "Transcribing",
    "jobs.drafting": "Writing Notes",
    "jobs.ready": "Ready",
    "jobs.pending": "Waiting",
    "jobs.inProgress": "Working",
    "jobs.completed": "Done",
    "jobs.failed": "Failed",
    "jobs.noJobs": "No jobs in queue",
    "jobs.noJobsDesc": "Jobs appear here when you record sessions.",
    "jobs.workerStatus": "Tool Status",
    "jobs.whisperReady": "Transcription tool ready",
    "jobs.whisperMissing": "Transcription tool not found",
    "jobs.ollamaReady": "Notes tool ready",
    "jobs.ollamaMissing": "Notes tool not found",
    "jobs.mockMode": "Using demo mode (results are samples)",

    // Settings
    "settings.title": "Settings",
    "settings.webPortal": "Web Portal Connection",
    "settings.apiUrl": "Portal Address",
    "settings.apiKey": "Connection Key",
    "settings.testConnection": "Test Connection",
    "settings.connectionOk": "Connected",
    "settings.connectionFailed": "Not connected",
    "settings.transcription": "Transcription",
    "settings.whisperPath": "Whisper Location",
    "settings.whisperModel": "Whisper Model",
    "settings.soapGeneration": "Notes Generation",
    "settings.ollamaPath": "Ollama Location",
    "settings.ollamaModel": "Ollama Model",
    "settings.backup": "Backup",
    "settings.autoBackup": "Automatic backups",
    "settings.backupPath": "Backup location",
    "settings.superbill": "Superbill",
    "settings.theme": "Appearance",
    "settings.themeLight": "Light",
    "settings.themeDark": "Dark",
    "settings.themeSystem": "System",
    "settings.language": "Language",
    "settings.dataSecurity": "Data Security",
    "settings.dataSecurityDesc": "All session recordings, transcripts, and notes stay on this computer. They are never uploaded to the internet.",

    // Common
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.loading": "Loading...",
    "common.error": "Something went wrong",
    "common.retry": "Try Again",
  },

  es: {
    // Navigation
    "nav.clients": "Clientes",
    "nav.session": "Grabar Sesión",
    "nav.jobs": "Tareas",
    "nav.settings": "Ajustes",

    // Clients
    "clients.title": "Clientes",
    "clients.search": "Buscar clientes...",
    "clients.noClients": "Sin clientes aún",
    "clients.noClientsDesc": "Agrega clientes primero desde el portal web.",
    "clients.consentComplete": "Listo para grabar",
    "clients.consentPending": "Formularios de consentimiento pendientes",
    "clients.syncConsent": "Verificar estado de consentimiento",

    // Session Recording
    "session.title": "Grabar Sesión",
    "session.selectClient": "Selecciona un Cliente",
    "session.selectClientDesc": "Elige un cliente de la lista para comenzar a grabar.",
    "session.ready": "Listo para Grabar",
    "session.readyDesc": "Haz clic en el botón para comenzar. El audio permanece en esta computadora.",
    "session.start": "Iniciar Grabación",
    "session.stop": "Detener Grabación",
    "session.recording": "Grabando...",
    "session.recordingDesc": "Sesión en progreso. Haz clic en detener cuando termines.",
    "session.processing": "Procesando...",
    "session.transcribing": "Creando transcripción...",
    "session.drafting": "Escribiendo borrador de notas...",
    "session.draftReady": "Borrador Listo",
    "session.draftReadyDesc": "Revisa y edita tus notas de sesión abajo.",
    "session.saveNotes": "Guardar Notas",
    "session.notesSaved": "Notas guardadas",

    // SOAP Editor
    "soap.title": "Notas de Sesión",
    "soap.aiDraft": "Borrador generado por IA — por favor revisa cuidadosamente",
    "soap.subjective": "Lo que el cliente compartió",
    "soap.objective": "Lo que observaste",
    "soap.assessment": "Tu evaluación",
    "soap.plan": "Próximos pasos",

    // Jobs
    "jobs.title": "Tareas en Segundo Plano",
    "jobs.pipeline": "Pipeline de Procesamiento",
    "jobs.audioSaved": "Audio Guardado",
    "jobs.transcribing": "Transcribiendo",
    "jobs.drafting": "Escribiendo Notas",
    "jobs.ready": "Listo",
    "jobs.pending": "Esperando",
    "jobs.inProgress": "Trabajando",
    "jobs.completed": "Completado",
    "jobs.failed": "Fallido",
    "jobs.noJobs": "Sin tareas en cola",
    "jobs.noJobsDesc": "Las tareas aparecen aquí cuando grabas sesiones.",
    "jobs.workerStatus": "Estado de Herramientas",
    "jobs.whisperReady": "Herramienta de transcripción lista",
    "jobs.whisperMissing": "Herramienta de transcripción no encontrada",
    "jobs.ollamaReady": "Herramienta de notas lista",
    "jobs.ollamaMissing": "Herramienta de notas no encontrada",
    "jobs.mockMode": "Usando modo demo (los resultados son muestras)",

    // Settings
    "settings.title": "Ajustes",
    "settings.webPortal": "Conexión al Portal Web",
    "settings.apiUrl": "Dirección del Portal",
    "settings.apiKey": "Clave de Conexión",
    "settings.testConnection": "Probar Conexión",
    "settings.connectionOk": "Conectado",
    "settings.connectionFailed": "No conectado",
    "settings.transcription": "Transcripción",
    "settings.whisperPath": "Ubicación de Whisper",
    "settings.whisperModel": "Modelo de Whisper",
    "settings.soapGeneration": "Generación de Notas",
    "settings.ollamaPath": "Ubicación de Ollama",
    "settings.ollamaModel": "Modelo de Ollama",
    "settings.backup": "Respaldo",
    "settings.autoBackup": "Respaldos automáticos",
    "settings.backupPath": "Ubicación de respaldo",
    "settings.superbill": "Superbill",
    "settings.theme": "Apariencia",
    "settings.themeLight": "Claro",
    "settings.themeDark": "Oscuro",
    "settings.themeSystem": "Sistema",
    "settings.language": "Idioma",
    "settings.dataSecurity": "Seguridad de Datos",
    "settings.dataSecurityDesc": "Todas las grabaciones, transcripciones y notas de sesión permanecen en esta computadora. Nunca se suben a internet.",

    // Common
    "common.save": "Guardar",
    "common.cancel": "Cancelar",
    "common.loading": "Cargando...",
    "common.error": "Algo salió mal",
    "common.retry": "Intentar de Nuevo",
  },

  de: {
    // Navigation
    "nav.clients": "Klienten",
    "nav.session": "Sitzung Aufnehmen",
    "nav.jobs": "Aufgaben",
    "nav.settings": "Einstellungen",

    // Clients
    "clients.title": "Klienten",
    "clients.search": "Klienten suchen...",
    "clients.noClients": "Noch keine Klienten",
    "clients.noClientsDesc": "Fügen Sie zuerst Klienten über das Web-Portal hinzu.",
    "clients.consentComplete": "Bereit zur Aufnahme",
    "clients.consentPending": "Einwilligungsformulare ausstehend",
    "clients.syncConsent": "Einwilligungsstatus prüfen",

    // Session Recording
    "session.title": "Sitzung Aufnehmen",
    "session.selectClient": "Klient Auswählen",
    "session.selectClientDesc": "Wählen Sie einen Klienten aus der Liste, um die Aufnahme zu starten.",
    "session.ready": "Bereit zur Aufnahme",
    "session.readyDesc": "Klicken Sie auf die Schaltfläche, um zu starten. Audio bleibt auf diesem Computer.",
    "session.start": "Aufnahme Starten",
    "session.stop": "Aufnahme Stoppen",
    "session.recording": "Aufnahme läuft...",
    "session.recordingDesc": "Sitzung läuft. Klicken Sie auf Stopp, wenn Sie fertig sind.",
    "session.processing": "Verarbeitung...",
    "session.transcribing": "Transkript wird erstellt...",
    "session.drafting": "Notizenentwurf wird geschrieben...",
    "session.draftReady": "Entwurf Fertig",
    "session.draftReadyDesc": "Überprüfen und bearbeiten Sie Ihre Sitzungsnotizen unten.",
    "session.saveNotes": "Notizen Speichern",
    "session.notesSaved": "Notizen gespeichert",

    // SOAP Editor
    "soap.title": "Sitzungsnotizen",
    "soap.aiDraft": "KI-generierter Entwurf — bitte sorgfältig überprüfen",
    "soap.subjective": "Was der Klient mitgeteilt hat",
    "soap.objective": "Was Sie beobachtet haben",
    "soap.assessment": "Ihre Einschätzung",
    "soap.plan": "Nächste Schritte",

    // Jobs
    "jobs.title": "Hintergrundaufgaben",
    "jobs.pipeline": "Verarbeitungspipeline",
    "jobs.audioSaved": "Audio Gespeichert",
    "jobs.transcribing": "Transkribieren",
    "jobs.drafting": "Notizen Schreiben",
    "jobs.ready": "Fertig",
    "jobs.pending": "Wartend",
    "jobs.inProgress": "In Arbeit",
    "jobs.completed": "Erledigt",
    "jobs.failed": "Fehlgeschlagen",
    "jobs.noJobs": "Keine Aufgaben in der Warteschlange",
    "jobs.noJobsDesc": "Aufgaben erscheinen hier, wenn Sie Sitzungen aufnehmen.",
    "jobs.workerStatus": "Werkzeugstatus",
    "jobs.whisperReady": "Transkriptionswerkzeug bereit",
    "jobs.whisperMissing": "Transkriptionswerkzeug nicht gefunden",
    "jobs.ollamaReady": "Notizenwerkzeug bereit",
    "jobs.ollamaMissing": "Notizenwerkzeug nicht gefunden",
    "jobs.mockMode": "Demo-Modus aktiv (Ergebnisse sind Beispiele)",

    // Settings
    "settings.title": "Einstellungen",
    "settings.webPortal": "Web-Portal-Verbindung",
    "settings.apiUrl": "Portal-Adresse",
    "settings.apiKey": "Verbindungsschlüssel",
    "settings.testConnection": "Verbindung Testen",
    "settings.connectionOk": "Verbunden",
    "settings.connectionFailed": "Nicht verbunden",
    "settings.transcription": "Transkription",
    "settings.whisperPath": "Whisper-Speicherort",
    "settings.whisperModel": "Whisper-Modell",
    "settings.soapGeneration": "Notizenerstellung",
    "settings.ollamaPath": "Ollama-Speicherort",
    "settings.ollamaModel": "Ollama-Modell",
    "settings.backup": "Sicherung",
    "settings.autoBackup": "Automatische Sicherungen",
    "settings.backupPath": "Sicherungsspeicherort",
    "settings.superbill": "Superbill",
    "settings.theme": "Erscheinungsbild",
    "settings.themeLight": "Hell",
    "settings.themeDark": "Dunkel",
    "settings.themeSystem": "System",
    "settings.language": "Sprache",
    "settings.dataSecurity": "Datensicherheit",
    "settings.dataSecurityDesc": "Alle Sitzungsaufnahmen, Transkripte und Notizen bleiben auf diesem Computer. Sie werden niemals ins Internet hochgeladen.",

    // Common
    "common.save": "Speichern",
    "common.cancel": "Abbrechen",
    "common.loading": "Laden...",
    "common.error": "Etwas ist schiefgelaufen",
    "common.retry": "Erneut Versuchen",
  },

  sv: {
    // Navigation
    "nav.clients": "Klienter",
    "nav.session": "Spela In Session",
    "nav.jobs": "Uppgifter",
    "nav.settings": "Inställningar",

    // Clients
    "clients.title": "Klienter",
    "clients.search": "Sök klienter...",
    "clients.noClients": "Inga klienter ännu",
    "clients.noClientsDesc": "Lägg till klienter via webbportalen först.",
    "clients.consentComplete": "Redo att spela in",
    "clients.consentPending": "Samtyckeformulär väntar",
    "clients.syncConsent": "Kontrollera samtyckestatus",

    // Session Recording
    "session.title": "Spela In Session",
    "session.selectClient": "Välj en Klient",
    "session.selectClientDesc": "Välj en klient från listan för att börja spela in.",
    "session.ready": "Redo att Spela In",
    "session.readyDesc": "Klicka på knappen för att starta. Ljudet stannar på denna dator.",
    "session.start": "Starta Inspelning",
    "session.stop": "Stoppa Inspelning",
    "session.recording": "Spelar in...",
    "session.recordingDesc": "Session pågår. Klicka på stopp när du är klar.",
    "session.processing": "Bearbetar...",
    "session.transcribing": "Skapar transkript...",
    "session.drafting": "Skriver anteckningsutkast...",
    "session.draftReady": "Utkast Klart",
    "session.draftReadyDesc": "Granska och redigera dina sessionsanteckningar nedan.",
    "session.saveNotes": "Spara Anteckningar",
    "session.notesSaved": "Anteckningar sparade",

    // SOAP Editor
    "soap.title": "Sessionsanteckningar",
    "soap.aiDraft": "AI-genererat utkast — vänligen granska noggrant",
    "soap.subjective": "Vad klienten delade",
    "soap.objective": "Vad du observerade",
    "soap.assessment": "Din bedömning",
    "soap.plan": "Nästa steg",

    // Jobs
    "jobs.title": "Bakgrundsuppgifter",
    "jobs.pipeline": "Bearbetningspipeline",
    "jobs.audioSaved": "Ljud Sparat",
    "jobs.transcribing": "Transkriberar",
    "jobs.drafting": "Skriver Anteckningar",
    "jobs.ready": "Klart",
    "jobs.pending": "Väntar",
    "jobs.inProgress": "Arbetar",
    "jobs.completed": "Klart",
    "jobs.failed": "Misslyckades",
    "jobs.noJobs": "Inga uppgifter i kö",
    "jobs.noJobsDesc": "Uppgifter visas här när du spelar in sessioner.",
    "jobs.workerStatus": "Verktygsstatus",
    "jobs.whisperReady": "Transkriptionsverktyg redo",
    "jobs.whisperMissing": "Transkriptionsverktyg hittades inte",
    "jobs.ollamaReady": "Anteckningsverktyg redo",
    "jobs.ollamaMissing": "Anteckningsverktyg hittades inte",
    "jobs.mockMode": "Använder demoläge (resultat är exempel)",

    // Settings
    "settings.title": "Inställningar",
    "settings.webPortal": "Webbportalanslutning",
    "settings.apiUrl": "Portaladress",
    "settings.apiKey": "Anslutningsnyckel",
    "settings.testConnection": "Testa Anslutning",
    "settings.connectionOk": "Ansluten",
    "settings.connectionFailed": "Inte ansluten",
    "settings.transcription": "Transkription",
    "settings.whisperPath": "Whisper-plats",
    "settings.whisperModel": "Whisper-modell",
    "settings.soapGeneration": "Anteckningsgenerering",
    "settings.ollamaPath": "Ollama-plats",
    "settings.ollamaModel": "Ollama-modell",
    "settings.backup": "Säkerhetskopiering",
    "settings.autoBackup": "Automatiska säkerhetskopior",
    "settings.backupPath": "Säkerhetskopieringsplats",
    "settings.superbill": "Superbill",
    "settings.theme": "Utseende",
    "settings.themeLight": "Ljust",
    "settings.themeDark": "Mörkt",
    "settings.themeSystem": "System",
    "settings.language": "Språk",
    "settings.dataSecurity": "Datasäkerhet",
    "settings.dataSecurityDesc": "Alla sessionsinspelningar, transkript och anteckningar stannar på denna dator. De laddas aldrig upp till internet.",

    // Common
    "common.save": "Spara",
    "common.cancel": "Avbryt",
    "common.loading": "Laddar...",
    "common.error": "Något gick fel",
    "common.retry": "Försök Igen",
  },
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const stored = localStorage.getItem("solopractice-language") as Language | null;
    if (stored && translations[stored]) {
      setLanguageState(stored);
    } else {
      const browserLang = navigator.language.split("-")[0] as Language;
      if (translations[browserLang]) {
        setLanguageState(browserLang);
      }
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("solopractice-language", lang);
    document.documentElement.lang = lang;
  };

  const t = (key: string): string => {
    return translations[language][key] || translations.en[key] || key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
