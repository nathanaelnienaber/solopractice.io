"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <div className="flex items-center justify-between">
          <CardTitle>{currentForm.title}</CardTitle>
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} of {forms.length}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <div
            className="whitespace-pre-wrap text-sm leading-relaxed max-h-96 overflow-y-auto p-4 bg-muted/50 rounded-lg"
          >
            {currentForm.content}
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <div>
            <label className="block text-sm font-medium mb-2">
              Type your full legal name to sign
            </label>
            <input
              type="text"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Your full name"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              By signing, I acknowledge that I have read and agree to the terms above.
            </p>
            <Button onClick={handleSign} loading={signing} disabled={!signature.trim()}>
              {isLastForm ? "Sign & Complete" : "Sign & Continue"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
