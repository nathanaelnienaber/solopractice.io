import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Button,
  PageBody,
  PageHeader,
  PageShell,
  Panel,
} from "./ui";

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
    <PageShell>
      <PageHeader
        title="Help"
        description="Answers to common questions"
        sticky
      />

      <PageBody narrow="md" className="space-y-4">
        <FaqItem question="I saw a security warning when I installed this. Is that normal?">
          <p>
            Yes. Windows shows a blue &ldquo;SmartScreen&rdquo; warning, and Mac
            shows a message about an &ldquo;unidentified developer,&rdquo; the
            first time you open a new app that isn&apos;t from a big software
            store. This happens because SoloPractice is a small, independent app,
            not because anything is wrong.
          </p>
          <p className="mt-2">
            On Windows: click &ldquo;More info,&rdquo; then &ldquo;Run
            anyway.&rdquo;
            <br />
            On Mac: right-click (or Control-click) the app, choose
            &ldquo;Open,&rdquo; then confirm &ldquo;Open&rdquo; in the dialog
            that appears.
          </p>
          <p className="mt-2">
            You only need to do this once, the first time you open the app.
          </p>
        </FaqItem>

        <FaqItem question="Where is my information kept, and how do I back it up?">
          <p>
            Everything you record and write is saved in a private folder on this
            computer. It is never uploaded anywhere.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={openDataFolder}
            loading={opening}
          >
            {opening ? "Opening…" : "Open my data folder"}
          </Button>
          <p className="mt-2">
            To back up, copy that whole folder to a USB drive or another computer
            every so often. If your computer is lost or replaced, copy the folder
            back to get your data working again.
          </p>
        </FaqItem>

        <FaqItem question="How do I uninstall SoloPractice?">
          <p>
            <span className="font-medium">Windows:</span> open Settings, then
            &ldquo;Apps,&rdquo; find SoloPractice in the list, and choose
            &ldquo;Uninstall.&rdquo;
          </p>
          <p className="mt-2">
            <span className="font-medium">Mac:</span> open your Applications
            folder, drag SoloPractice to the Trash, then empty the Trash.
          </p>
          <p className="mt-2">
            Uninstalling removes the app itself but does not delete your private
            data folder, so your client notes and recordings stay safe on your
            computer. Delete that folder yourself if you want to permanently
            erase everything, after you&apos;ve made any backup you want.
          </p>
        </FaqItem>

        <FaqItem question="Do I have to set up speech-to-text or AI drafting?">
          <p>
            No. Both are optional. You can always write your own session notes by
            hand, create superbills, and see your client list and session history
            without either one turned on. You can turn them on later from
            Settings, whenever you&apos;re ready.
          </p>
        </FaqItem>

        <FaqItem question="Does any of my client's information ever leave this computer?">
          <p>
            Session recordings, transcripts, clinical notes, and superbills stay
            on this computer only. The only thing this app ever sends anywhere is
            a plain &ldquo;has this client signed their consent form&rdquo;
            check, so the app knows it&apos;s safe to start recording. That check
            never includes anything about the session itself.
          </p>
        </FaqItem>

        <FaqItem question="Something isn't working. What do I do?">
          <p>
            Close and reopen the app first — that fixes most issues. If a
            recording or note doesn&apos;t seem to save, check the Background
            Jobs tab to see if anything is stuck. If you skipped setup, run it
            again from Settings.
          </p>
        </FaqItem>
      </PageBody>
    </PageShell>
  );
}

function FaqItem({
  question,
  children,
}: {
  question: string;
  children: React.ReactNode;
}) {
  return (
    <Panel>
      <h2 className="text-base font-medium tracking-tight">{question}</h2>
      <div className="text-sm text-muted-foreground space-y-2">{children}</div>
    </Panel>
  );
}
