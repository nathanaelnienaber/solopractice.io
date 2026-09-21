"use client";

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
    "nav.home": "Home",
    "nav.dashboard": "Dashboard",
    "nav.clients": "Clients",
    "nav.invoices": "Invoices",
    "nav.settings": "Settings",
    "nav.signOut": "Sign Out",

    // Home page
    "home.title": "Your Practice, Simplified",
    "home.subtitle": "A simple tool to help you focus on what matters most — your clients.",
    "home.forTherapists": "For Therapists",
    "home.forClients": "For Clients",
    "home.getStarted": "Get Started",
    "home.signIn": "Sign In",

    // Features
    "feature.secureNotes": "Private Notes",
    "feature.secureNotesDesc": "Your session notes stay on your computer. They're never uploaded anywhere.",
    "feature.easyConsent": "Easy Consent Forms",
    "feature.easyConsentDesc": "Clients sign forms online before their first session. No paper needed.",
    "feature.simpleInvoicing": "Simple Invoicing",
    "feature.simpleInvoicingDesc": "Create and send invoices with a few clicks. Get paid faster.",
    "feature.recordings": "Session Recordings",
    "feature.recordingsDesc": "Record sessions locally. Get automatic transcripts and note drafts.",

    // Auth
    "auth.email": "Email",
    "auth.emailPlaceholder": "you@example.com",
    "auth.sendLink": "Send Sign-In Link",
    "auth.checkEmail": "Check your email",
    "auth.linkSent": "We sent you a sign-in link. Click it to continue.",
    "auth.therapistLogin": "Therapist Sign In",
    "auth.therapistLoginDesc": "Enter your email and we'll send you a link to sign in.",

    // Dashboard
    "dashboard.welcome": "Welcome back",
    "dashboard.totalClients": "Total Clients",
    "dashboard.pendingInvoices": "Unpaid Invoices",
    "dashboard.upcomingAppts": "Upcoming Appointments",
    "dashboard.recentActivity": "Recent Activity",
    "dashboard.noActivity": "No recent activity",
    "dashboard.stripeNotConnected": "Payment setup incomplete",
    "dashboard.stripeNotConnectedDesc": "Connect your payment account to start receiving payments.",
    "dashboard.connectStripe": "Set Up Payments",

    // Clients
    "clients.title": "Clients",
    "clients.addNew": "Add Client",
    "clients.search": "Search clients...",
    "clients.noClients": "No clients yet",
    "clients.noClientsDesc": "Add your first client to get started.",
    "clients.name": "Name",
    "clients.email": "Email",
    "clients.phone": "Phone",
    "clients.consentStatus": "Forms",
    "clients.actions": "Actions",
    "clients.sendForms": "Send Forms",
    "clients.formsSent": "Forms Sent",
    "clients.formsComplete": "Complete",
    "clients.formsPending": "Pending",

    // Consents
    "consent.title": "Consent Forms",
    "consent.draftWarning": "DRAFT — NOT LEGAL ADVICE",
    "consent.draftDesc": "These forms are samples only. Have a healthcare attorney review them before use with real clients.",
    "consent.sign": "Sign",
    "consent.signed": "Signed",
    "consent.signatureLabel": "Type your full legal name to sign",
    "consent.signaturePlaceholder": "Your full name",
    "consent.submitSignature": "Sign This Form",
    "consent.allSigned": "All Forms Signed",
    "consent.allSignedDesc": "Thank you! You can close this page.",

    // Invoices
    "invoices.title": "Invoices",
    "invoices.create": "Create Invoice",
    "invoices.noInvoices": "No invoices yet",
    "invoices.noInvoicesDesc": "Create your first invoice to get started.",
    "invoices.client": "Client",
    "invoices.amount": "Amount",
    "invoices.status": "Status",
    "invoices.date": "Date",
    "invoices.send": "Send",
    "invoices.paid": "Paid",
    "invoices.pending": "Pending",
    "invoices.sent": "Sent",
    "invoices.description": "Description",
    "invoices.descriptionPlaceholder": "Session on...",

    // Settings
    "settings.title": "Settings",
    "settings.practice": "Practice Info",
    "settings.practiceName": "Practice Name",
    "settings.practiceNamePlaceholder": "Your Practice Name",
    "settings.payments": "Payments",
    "settings.paymentsConnected": "Payment account connected",
    "settings.paymentsNotConnected": "Payment account not connected",
    "settings.connectPayments": "Connect Payment Account",
    "settings.consentForms": "Consent Forms",
    "settings.theme": "Appearance",
    "settings.themeLight": "Light",
    "settings.themeDark": "Dark",
    "settings.themeSystem": "System",
    "settings.language": "Language",

    // Common
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.loading": "Loading...",
    "common.error": "Something went wrong",
    "common.tryAgain": "Try Again",
    "common.close": "Close",
    "common.back": "Back",
    "common.next": "Next",
    "common.submit": "Submit",
    "common.required": "Required",

    // Security
    "security.title": "Your Privacy Matters",
    "security.localData": "Clinical notes and recordings stay on your computer",
    "security.encrypted": "Data is encrypted and protected",
    "security.noCloud": "No sensitive information is uploaded to the cloud",
  },

  es: {
    // Navigation
    "nav.home": "Inicio",
    "nav.dashboard": "Panel",
    "nav.clients": "Clientes",
    "nav.invoices": "Facturas",
    "nav.settings": "Ajustes",
    "nav.signOut": "Cerrar Sesión",

    // Home page
    "home.title": "Tu Consulta, Simplificada",
    "home.subtitle": "Una herramienta simple para ayudarte a enfocarte en lo más importante — tus clientes.",
    "home.forTherapists": "Para Terapeutas",
    "home.forClients": "Para Clientes",
    "home.getStarted": "Comenzar",
    "home.signIn": "Iniciar Sesión",

    // Features
    "feature.secureNotes": "Notas Privadas",
    "feature.secureNotesDesc": "Tus notas de sesión permanecen en tu computadora. Nunca se suben a ningún lugar.",
    "feature.easyConsent": "Formularios de Consentimiento Fáciles",
    "feature.easyConsentDesc": "Los clientes firman formularios en línea antes de su primera sesión. Sin papel.",
    "feature.simpleInvoicing": "Facturación Simple",
    "feature.simpleInvoicingDesc": "Crea y envía facturas con unos pocos clics. Cobra más rápido.",
    "feature.recordings": "Grabaciones de Sesión",
    "feature.recordingsDesc": "Graba sesiones localmente. Obtén transcripciones automáticas y borradores de notas.",

    // Auth
    "auth.email": "Correo Electrónico",
    "auth.emailPlaceholder": "tu@ejemplo.com",
    "auth.sendLink": "Enviar Enlace de Acceso",
    "auth.checkEmail": "Revisa tu correo",
    "auth.linkSent": "Te enviamos un enlace de acceso. Haz clic para continuar.",
    "auth.therapistLogin": "Acceso para Terapeutas",
    "auth.therapistLoginDesc": "Ingresa tu correo y te enviaremos un enlace para acceder.",

    // Dashboard
    "dashboard.welcome": "Bienvenido de nuevo",
    "dashboard.totalClients": "Total de Clientes",
    "dashboard.pendingInvoices": "Facturas Pendientes",
    "dashboard.upcomingAppts": "Próximas Citas",
    "dashboard.recentActivity": "Actividad Reciente",
    "dashboard.noActivity": "Sin actividad reciente",
    "dashboard.stripeNotConnected": "Configuración de pagos incompleta",
    "dashboard.stripeNotConnectedDesc": "Conecta tu cuenta de pagos para empezar a recibir pagos.",
    "dashboard.connectStripe": "Configurar Pagos",

    // Clients
    "clients.title": "Clientes",
    "clients.addNew": "Agregar Cliente",
    "clients.search": "Buscar clientes...",
    "clients.noClients": "Sin clientes aún",
    "clients.noClientsDesc": "Agrega tu primer cliente para comenzar.",
    "clients.name": "Nombre",
    "clients.email": "Correo",
    "clients.phone": "Teléfono",
    "clients.consentStatus": "Formularios",
    "clients.actions": "Acciones",
    "clients.sendForms": "Enviar Formularios",
    "clients.formsSent": "Formularios Enviados",
    "clients.formsComplete": "Completo",
    "clients.formsPending": "Pendiente",

    // Consents
    "consent.title": "Formularios de Consentimiento",
    "consent.draftWarning": "BORRADOR — NO ES ASESORÍA LEGAL",
    "consent.draftDesc": "Estos formularios son solo muestras. Consulta con un abogado de salud antes de usarlos con clientes reales.",
    "consent.sign": "Firmar",
    "consent.signed": "Firmado",
    "consent.signatureLabel": "Escribe tu nombre legal completo para firmar",
    "consent.signaturePlaceholder": "Tu nombre completo",
    "consent.submitSignature": "Firmar Este Formulario",
    "consent.allSigned": "Todos los Formularios Firmados",
    "consent.allSignedDesc": "¡Gracias! Puedes cerrar esta página.",

    // Invoices
    "invoices.title": "Facturas",
    "invoices.create": "Crear Factura",
    "invoices.noInvoices": "Sin facturas aún",
    "invoices.noInvoicesDesc": "Crea tu primera factura para comenzar.",
    "invoices.client": "Cliente",
    "invoices.amount": "Monto",
    "invoices.status": "Estado",
    "invoices.date": "Fecha",
    "invoices.send": "Enviar",
    "invoices.paid": "Pagada",
    "invoices.pending": "Pendiente",
    "invoices.sent": "Enviada",
    "invoices.description": "Descripción",
    "invoices.descriptionPlaceholder": "Sesión del...",

    // Settings
    "settings.title": "Ajustes",
    "settings.practice": "Información de la Consulta",
    "settings.practiceName": "Nombre de la Consulta",
    "settings.practiceNamePlaceholder": "Nombre de Tu Consulta",
    "settings.payments": "Pagos",
    "settings.paymentsConnected": "Cuenta de pagos conectada",
    "settings.paymentsNotConnected": "Cuenta de pagos no conectada",
    "settings.connectPayments": "Conectar Cuenta de Pagos",
    "settings.consentForms": "Formularios de Consentimiento",
    "settings.theme": "Apariencia",
    "settings.themeLight": "Claro",
    "settings.themeDark": "Oscuro",
    "settings.themeSystem": "Sistema",
    "settings.language": "Idioma",

    // Common
    "common.save": "Guardar",
    "common.cancel": "Cancelar",
    "common.delete": "Eliminar",
    "common.edit": "Editar",
    "common.loading": "Cargando...",
    "common.error": "Algo salió mal",
    "common.tryAgain": "Intentar de Nuevo",
    "common.close": "Cerrar",
    "common.back": "Atrás",
    "common.next": "Siguiente",
    "common.submit": "Enviar",
    "common.required": "Requerido",

    // Security
    "security.title": "Tu Privacidad Importa",
    "security.localData": "Las notas clínicas y grabaciones permanecen en tu computadora",
    "security.encrypted": "Los datos están encriptados y protegidos",
    "security.noCloud": "No se sube información sensible a la nube",
  },

  de: {
    // Navigation
    "nav.home": "Startseite",
    "nav.dashboard": "Übersicht",
    "nav.clients": "Klienten",
    "nav.invoices": "Rechnungen",
    "nav.settings": "Einstellungen",
    "nav.signOut": "Abmelden",

    // Home page
    "home.title": "Ihre Praxis, Vereinfacht",
    "home.subtitle": "Ein einfaches Werkzeug, das Ihnen hilft, sich auf das Wichtigste zu konzentrieren — Ihre Klienten.",
    "home.forTherapists": "Für Therapeuten",
    "home.forClients": "Für Klienten",
    "home.getStarted": "Loslegen",
    "home.signIn": "Anmelden",

    // Features
    "feature.secureNotes": "Private Notizen",
    "feature.secureNotesDesc": "Ihre Sitzungsnotizen bleiben auf Ihrem Computer. Sie werden nirgendwo hochgeladen.",
    "feature.easyConsent": "Einfache Einwilligungsformulare",
    "feature.easyConsentDesc": "Klienten unterschreiben Formulare online vor ihrer ersten Sitzung. Kein Papier nötig.",
    "feature.simpleInvoicing": "Einfache Rechnungsstellung",
    "feature.simpleInvoicingDesc": "Erstellen und senden Sie Rechnungen mit wenigen Klicks. Schneller bezahlt werden.",
    "feature.recordings": "Sitzungsaufnahmen",
    "feature.recordingsDesc": "Nehmen Sie Sitzungen lokal auf. Erhalten Sie automatische Transkripte und Notizentwürfe.",

    // Auth
    "auth.email": "E-Mail",
    "auth.emailPlaceholder": "sie@beispiel.de",
    "auth.sendLink": "Anmeldelink Senden",
    "auth.checkEmail": "Prüfen Sie Ihre E-Mail",
    "auth.linkSent": "Wir haben Ihnen einen Anmeldelink gesendet. Klicken Sie darauf, um fortzufahren.",
    "auth.therapistLogin": "Therapeuten-Anmeldung",
    "auth.therapistLoginDesc": "Geben Sie Ihre E-Mail ein und wir senden Ihnen einen Anmeldelink.",

    // Dashboard
    "dashboard.welcome": "Willkommen zurück",
    "dashboard.totalClients": "Gesamte Klienten",
    "dashboard.pendingInvoices": "Unbezahlte Rechnungen",
    "dashboard.upcomingAppts": "Anstehende Termine",
    "dashboard.recentActivity": "Letzte Aktivität",
    "dashboard.noActivity": "Keine aktuelle Aktivität",
    "dashboard.stripeNotConnected": "Zahlungseinrichtung unvollständig",
    "dashboard.stripeNotConnectedDesc": "Verbinden Sie Ihr Zahlungskonto, um Zahlungen zu empfangen.",
    "dashboard.connectStripe": "Zahlungen Einrichten",

    // Clients
    "clients.title": "Klienten",
    "clients.addNew": "Klient Hinzufügen",
    "clients.search": "Klienten suchen...",
    "clients.noClients": "Noch keine Klienten",
    "clients.noClientsDesc": "Fügen Sie Ihren ersten Klienten hinzu, um zu beginnen.",
    "clients.name": "Name",
    "clients.email": "E-Mail",
    "clients.phone": "Telefon",
    "clients.consentStatus": "Formulare",
    "clients.actions": "Aktionen",
    "clients.sendForms": "Formulare Senden",
    "clients.formsSent": "Formulare Gesendet",
    "clients.formsComplete": "Vollständig",
    "clients.formsPending": "Ausstehend",

    // Consents
    "consent.title": "Einwilligungsformulare",
    "consent.draftWarning": "ENTWURF — KEINE RECHTSBERATUNG",
    "consent.draftDesc": "Diese Formulare sind nur Muster. Lassen Sie sie von einem Gesundheitsanwalt prüfen, bevor Sie sie mit echten Klienten verwenden.",
    "consent.sign": "Unterschreiben",
    "consent.signed": "Unterschrieben",
    "consent.signatureLabel": "Geben Sie Ihren vollständigen Namen ein, um zu unterschreiben",
    "consent.signaturePlaceholder": "Ihr vollständiger Name",
    "consent.submitSignature": "Dieses Formular Unterschreiben",
    "consent.allSigned": "Alle Formulare Unterschrieben",
    "consent.allSignedDesc": "Vielen Dank! Sie können diese Seite schließen.",

    // Invoices
    "invoices.title": "Rechnungen",
    "invoices.create": "Rechnung Erstellen",
    "invoices.noInvoices": "Noch keine Rechnungen",
    "invoices.noInvoicesDesc": "Erstellen Sie Ihre erste Rechnung, um zu beginnen.",
    "invoices.client": "Klient",
    "invoices.amount": "Betrag",
    "invoices.status": "Status",
    "invoices.date": "Datum",
    "invoices.send": "Senden",
    "invoices.paid": "Bezahlt",
    "invoices.pending": "Ausstehend",
    "invoices.sent": "Gesendet",
    "invoices.description": "Beschreibung",
    "invoices.descriptionPlaceholder": "Sitzung am...",

    // Settings
    "settings.title": "Einstellungen",
    "settings.practice": "Praxisinfo",
    "settings.practiceName": "Praxisname",
    "settings.practiceNamePlaceholder": "Ihr Praxisname",
    "settings.payments": "Zahlungen",
    "settings.paymentsConnected": "Zahlungskonto verbunden",
    "settings.paymentsNotConnected": "Zahlungskonto nicht verbunden",
    "settings.connectPayments": "Zahlungskonto Verbinden",
    "settings.consentForms": "Einwilligungsformulare",
    "settings.theme": "Erscheinungsbild",
    "settings.themeLight": "Hell",
    "settings.themeDark": "Dunkel",
    "settings.themeSystem": "System",
    "settings.language": "Sprache",

    // Common
    "common.save": "Speichern",
    "common.cancel": "Abbrechen",
    "common.delete": "Löschen",
    "common.edit": "Bearbeiten",
    "common.loading": "Laden...",
    "common.error": "Etwas ist schiefgelaufen",
    "common.tryAgain": "Erneut Versuchen",
    "common.close": "Schließen",
    "common.back": "Zurück",
    "common.next": "Weiter",
    "common.submit": "Absenden",
    "common.required": "Erforderlich",

    // Security
    "security.title": "Ihre Privatsphäre Zählt",
    "security.localData": "Klinische Notizen und Aufnahmen bleiben auf Ihrem Computer",
    "security.encrypted": "Daten sind verschlüsselt und geschützt",
    "security.noCloud": "Keine sensiblen Informationen werden in die Cloud hochgeladen",
  },

  sv: {
    // Navigation
    "nav.home": "Hem",
    "nav.dashboard": "Översikt",
    "nav.clients": "Klienter",
    "nav.invoices": "Fakturor",
    "nav.settings": "Inställningar",
    "nav.signOut": "Logga Ut",

    // Home page
    "home.title": "Din Praktik, Förenklad",
    "home.subtitle": "Ett enkelt verktyg som hjälper dig fokusera på det viktigaste — dina klienter.",
    "home.forTherapists": "För Terapeuter",
    "home.forClients": "För Klienter",
    "home.getStarted": "Kom Igång",
    "home.signIn": "Logga In",

    // Features
    "feature.secureNotes": "Privata Anteckningar",
    "feature.secureNotesDesc": "Dina sessionsanteckningar stannar på din dator. De laddas aldrig upp någonstans.",
    "feature.easyConsent": "Enkla Samtyckeformulär",
    "feature.easyConsentDesc": "Klienter signerar formulär online före sin första session. Inget papper behövs.",
    "feature.simpleInvoicing": "Enkel Fakturering",
    "feature.simpleInvoicingDesc": "Skapa och skicka fakturor med några få klick. Få betalt snabbare.",
    "feature.recordings": "Sessionsinspelningar",
    "feature.recordingsDesc": "Spela in sessioner lokalt. Få automatiska transkriptioner och anteckningsutkast.",

    // Auth
    "auth.email": "E-post",
    "auth.emailPlaceholder": "du@exempel.se",
    "auth.sendLink": "Skicka Inloggningslänk",
    "auth.checkEmail": "Kolla din e-post",
    "auth.linkSent": "Vi har skickat dig en inloggningslänk. Klicka på den för att fortsätta.",
    "auth.therapistLogin": "Terapeut Inloggning",
    "auth.therapistLoginDesc": "Ange din e-post så skickar vi dig en länk för att logga in.",

    // Dashboard
    "dashboard.welcome": "Välkommen tillbaka",
    "dashboard.totalClients": "Totalt Antal Klienter",
    "dashboard.pendingInvoices": "Obetalda Fakturor",
    "dashboard.upcomingAppts": "Kommande Möten",
    "dashboard.recentActivity": "Senaste Aktivitet",
    "dashboard.noActivity": "Ingen senaste aktivitet",
    "dashboard.stripeNotConnected": "Betalningsinställning ofullständig",
    "dashboard.stripeNotConnectedDesc": "Anslut ditt betalningskonto för att börja ta emot betalningar.",
    "dashboard.connectStripe": "Konfigurera Betalningar",

    // Clients
    "clients.title": "Klienter",
    "clients.addNew": "Lägg Till Klient",
    "clients.search": "Sök klienter...",
    "clients.noClients": "Inga klienter ännu",
    "clients.noClientsDesc": "Lägg till din första klient för att komma igång.",
    "clients.name": "Namn",
    "clients.email": "E-post",
    "clients.phone": "Telefon",
    "clients.consentStatus": "Formulär",
    "clients.actions": "Åtgärder",
    "clients.sendForms": "Skicka Formulär",
    "clients.formsSent": "Formulär Skickade",
    "clients.formsComplete": "Klart",
    "clients.formsPending": "Väntar",

    // Consents
    "consent.title": "Samtyckeformulär",
    "consent.draftWarning": "UTKAST — INTE JURIDISK RÅDGIVNING",
    "consent.draftDesc": "Dessa formulär är endast exempel. Låt en hälsojurist granska dem innan du använder dem med riktiga klienter.",
    "consent.sign": "Signera",
    "consent.signed": "Signerad",
    "consent.signatureLabel": "Skriv ditt fullständiga namn för att signera",
    "consent.signaturePlaceholder": "Ditt fullständiga namn",
    "consent.submitSignature": "Signera Detta Formulär",
    "consent.allSigned": "Alla Formulär Signerade",
    "consent.allSignedDesc": "Tack! Du kan stänga denna sida.",

    // Invoices
    "invoices.title": "Fakturor",
    "invoices.create": "Skapa Faktura",
    "invoices.noInvoices": "Inga fakturor ännu",
    "invoices.noInvoicesDesc": "Skapa din första faktura för att komma igång.",
    "invoices.client": "Klient",
    "invoices.amount": "Belopp",
    "invoices.status": "Status",
    "invoices.date": "Datum",
    "invoices.send": "Skicka",
    "invoices.paid": "Betald",
    "invoices.pending": "Väntar",
    "invoices.sent": "Skickad",
    "invoices.description": "Beskrivning",
    "invoices.descriptionPlaceholder": "Session den...",

    // Settings
    "settings.title": "Inställningar",
    "settings.practice": "Praktikinformation",
    "settings.practiceName": "Praktiknamn",
    "settings.practiceNamePlaceholder": "Ditt Praktiknamn",
    "settings.payments": "Betalningar",
    "settings.paymentsConnected": "Betalningskonto anslutet",
    "settings.paymentsNotConnected": "Betalningskonto inte anslutet",
    "settings.connectPayments": "Anslut Betalningskonto",
    "settings.consentForms": "Samtyckeformulär",
    "settings.theme": "Utseende",
    "settings.themeLight": "Ljust",
    "settings.themeDark": "Mörkt",
    "settings.themeSystem": "System",
    "settings.language": "Språk",

    // Common
    "common.save": "Spara",
    "common.cancel": "Avbryt",
    "common.delete": "Ta Bort",
    "common.edit": "Redigera",
    "common.loading": "Laddar...",
    "common.error": "Något gick fel",
    "common.tryAgain": "Försök Igen",
    "common.close": "Stäng",
    "common.back": "Tillbaka",
    "common.next": "Nästa",
    "common.submit": "Skicka",
    "common.required": "Obligatorisk",

    // Security
    "security.title": "Din Integritet Är Viktig",
    "security.localData": "Kliniska anteckningar och inspelningar stannar på din dator",
    "security.encrypted": "Data är krypterad och skyddad",
    "security.noCloud": "Ingen känslig information laddas upp till molnet",
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
