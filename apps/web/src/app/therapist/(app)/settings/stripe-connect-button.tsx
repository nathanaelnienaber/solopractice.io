"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface StripeConnectButtonProps {
  accountId?: string;
  label?: string;
}

export function StripeConnectButton({
  accountId,
  label = "Connect with Stripe",
}: StripeConnectButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });

      if (!res.ok) {
        throw new Error("Failed to create Stripe link");
      }

      const { url } = await res.json();
      window.location.href = url;
    } catch (error) {
      console.error(error);
      alert("Failed to connect with Stripe. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleClick} loading={loading}>
      {label}
    </Button>
  );
}
