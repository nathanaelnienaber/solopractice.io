"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ConsentFormPreview {
  type: string;
  title: string;
  version: string;
  content: string;
}

interface ConsentFormsPanelProps {
  forms: ConsentFormPreview[];
}

export function ConsentFormsPanel({ forms }: ConsentFormsPanelProps) {
  const [selected, setSelected] = useState<ConsentFormPreview | null>(null);

  return (
    <>
      <div className="space-y-2">
        {forms.map((form, index) => (
          <button
            key={form.type}
            type="button"
            onClick={() => setSelected(form)}
            className={`flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-accent/50 rounded-md px-2 -mx-2 transition-colors ${
              index < forms.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <span className="font-medium">{form.title}</span>
            <span className="shrink-0 text-sm text-muted-foreground">
              Review
            </span>
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        <strong>Note:</strong> These are draft templates for testing.
        Have a healthcare attorney review them before using with real clients.
      </p>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:rounded-lg">
          {selected && (
            <>
              <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-4 pr-12 text-left">
                <DialogTitle>{selected.title}</DialogTitle>
                <DialogDescription>
                  Draft template v{selected.version} — not legal advice
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {selected.content.trim()}
                </div>
              </div>
              <div className="shrink-0 border-t border-border px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setSelected(null)}
                >
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
