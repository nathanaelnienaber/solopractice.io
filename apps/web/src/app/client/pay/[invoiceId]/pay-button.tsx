"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface PayButtonProps {
  invoiceId: string;
}

export function PayButton({ invoiceId }: PayButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/checkout`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to create checkout session");
      }

      const { url } = await res.json();
      window.location.href = url;
    } catch (error) {
      alert("Failed to start payment. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button className="w-full" size="lg" onClick={handlePay} loading={loading}>
      Pay Now
    </Button>
  );
}
