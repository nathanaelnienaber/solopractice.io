import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function Help() {
  const [opening, setOpening] = useState(false);

  async function openDataFolder() {
    setOpening(true);
    try {
      await invoke("reveal_data_folder");
    } catch (err) {
      alert("Couldn't open the folder: " + err);
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <header className="p-4 border-b border-border sticky top-0 bg-background">
        <h1 className="text-xl font-semibold">Help</h1>
        <p className="text-sm text-muted-foreground mt-1">Answers to common questions</p>
      </header>

      <div className="p-4 space-y-6 max-w-2xl">
        <FaqItem question="I saw a security warning when I installed this. Is that normal?">
          <p>
            Yes. Windows shows a blue "SmartScreen" warning, and Mac shows a message about an
            "unidentified developer," the first time you open a new app that isn't from a big
            software store. This happens because SoloPractice is a small, independent app, not
            because anything is wrong.
          </p>
          <p className="mt-2">
            On Windows: click "More info," then "Run anyway."
            <br />
            On Mac: right-click (or Control-click) the app, choose "Open," then confirm "Open"
            in the dialog that appears.
          </p>
          <p className="mt-2">
            You only need to do this once, the first time you open the app.
          </p>
        </FaqItem>

        <FaqItem question="Where is my information kept, and how do I back it up?">
          <p>
            Everything you record and write is saved in a private folder on this computer. It is
            never uploaded anywhere.
          </p>
          <button
            onClick={openDataFolder}
            disabled={opening}
            className="mt-2 px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent disabled:opacity-50"
          >
            {opening ? "Opening..." : "Open my data folder"}
          </button>
          <p className="mt-2">
            To back up, copy that whole folder to a USB drive or another computer every so often.
            If your computer is lost or replaced, copy the folder back to get your data working
            again.
          </p>
        </FaqItem>

        <FaqItem question="How do I uninstall SoloPractice?">
          <p>
            <span className="font-medium">Windows:</span> open Settings, then "Apps," find
            SoloPractice in the list, and choose "Uninstall."
          </p>
          <p className="mt-2">
            <span className="font-medium">Mac:</span> open your Applications folder, drag
            SoloPractice to the Trash, then empty the Trash.
          </p>
          <p className="mt-2">
            Uninstalling removes the app itself but does not delete your private data folder, so
            your client notes and recordings stay safe on your computer. Delete that folder
            yourself if you want to permanently erase everything, after you've made any backup
            you want.
          </p>
        </FaqItem>

        <FaqItem question="Do I have to set up speech-to-text or AI drafting?">
          <p>
            No. Both are optional. You can always write your own session notes by hand, create
            superbills, and see your client list and session history without either one turned
            on. You can turn them on later from Settings, whenever you're ready.
          </p>
        </FaqItem>

        <FaqItem question="Does any of my client's information ever leave this computer?">
          <p>
            Session recordings, transcripts, clinical notes, and superbills stay on this computer
            only. The only thing this app ever sends anywhere is a plain "has this client signed
            their consent form" check, so the app knows it's safe to start recording. That check
            never includes anything about the session itself.
          </p>
        </FaqItem>

        <FaqItem question="Something isn't working. What do I do?">
          <p>
            Close and reopen the app first, that fixes most issues. If a recording or note
            doesn't seem to save, check the Background Jobs tab to see if anything is stuck. If
            you're still stuck, reach out to your SoloPractice contact and describe what
            happened, including whether you saw any message on screen.
          </p>
        </FaqItem>
      </div>
    </div>
  );
}

function FaqItem({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-medium">{question}</h2>
      <div className="text-sm text-muted-foreground">{children}</div>
    </section>
  );
}
