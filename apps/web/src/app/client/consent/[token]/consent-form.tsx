"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ActionStack,
  touchStackActionClassName,
} from "@/components/ui/page";
import type { ConsentType } from "@solopractice/shared";

interface FormTemplate {
  type: ConsentType;
  title: string;
  version: string;
  content: string;
  versionHash: string;
}

interface ConsentFormProps {
  clientId: string;
  token: string;
  forms: FormTemplate[];
}

export function ConsentForm({ clientId, token, forms }: ConsentFormProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [signing, setSigning] = useState(false);
  const [signature, setSignature] = useState("");

  const currentForm = forms[currentIndex];
  const isLastForm = currentIndex === forms.length - 1;

  async function handleSign() {
    if (!signature.trim()) {
      alert("Please type your name to sign");
      return;
    }

    setSigning(true);
    try {
      const res = await fetch("/api/consents/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          token,
          consentType: currentForm.type,
          formVersionHash: currentForm.versionHash,
          signatureData: signature,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to sign consent");
      }

      if (isLastForm) {
        router.refresh();
      } else {
        setSignature("");
        setCurrentIndex((i) => i + 1);
      }
    } catch (error) {
      alert("Failed to sign. Please try again.");
    } finally {
      setSigning(false);
    }
  }

  if (!currentForm) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="min-w-0">{currentForm.title}</CardTitle>
          <span className="shrink-0 text-sm text-muted-foreground">
            {currentIndex + 1} of {forms.length}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">
            {currentForm.content}
          </div>
        </div>

        <div className="space-y-4 border-t pt-4">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Type your full legal name to sign
            </label>
            <input
              type="text"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Your full name"
              className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <ActionStack>
            <p className="text-xs text-muted-foreground">
              By signing, I acknowledge that I have read and agree to the terms above.
            </p>
            <Button
              className={touchStackActionClassName}
              onClick={handleSign}
              loading={signing}
              disabled={!signature.trim()}
            >
              {isLastForm ? "Sign & Complete" : "Sign & Continue"}
            </Button>
          </ActionStack>
        </div>
      </CardContent>
    </Card>
  );
}
