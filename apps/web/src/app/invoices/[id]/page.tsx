'use client';

import { useState } from 'react';
import type { WebInvoice } from '@solopractice/shared';

// Mock invoice for demo
const mockInvoice: WebInvoice = {
  id: 'inv_demo_123',
  clientId: 'client_demo',
  sessionRef: 'session_demo',
  amountCents: 15000,
  currency: 'usd',
  description: 'Individual therapy session - 45 minutes',
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  status: 'sent',
  platformFeeCents: 150,
  stripeFeeCents: 465,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export default function InvoicePage({ params }: { params: { id: string } }) {
  const [isProcessing, setIsProcessing] = useState(false);

  // In production, fetch invoice by ID
  const invoice = mockInvoice;

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handlePay = async () => {
    setIsProcessing(true);
    try {
      // In production, this would create a Stripe Checkout session and redirect
      await new Promise((resolve) => setTimeout(resolve, 1000));
      alert('In production, this would redirect to Stripe Checkout');
    } finally {
      setIsProcessing(false);
    }
  };

  if (invoice.status === 'paid') {
    return (
      <div className="card text-center py-12">
        <div className="text-6xl mb-4">✓</div>
        <h2 className="text-2xl font-bold text-green-700 mb-4">Invoice Paid</h2>
        <p className="text-gray-600">
          Thank you for your payment of {formatCurrency(invoice.amountCents)}.
        </p>
        {invoice.paidAt && (
          <p className="text-sm text-gray-500 mt-2">
            Paid on {formatDate(invoice.paidAt)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Invoice</h2>
            <p className="text-sm text-gray-500">#{invoice.id}</p>
          </div>
          <StatusBadge status={invoice.status} />
        </div>

        <div className="border-t border-gray-200 pt-6">
          <table className="w-full">
            <tbody>
              <tr>
                <td className="py-2 text-gray-600">Description</td>
                <td className="py-2 text-right font-medium">{invoice.description}</td>
              </tr>
              <tr>
                <td className="py-2 text-gray-600">Amount</td>
                <td className="py-2 text-right font-medium text-xl">
                  {formatCurrency(invoice.amountCents)}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-gray-600">Due Date</td>
                <td className="py-2 text-right">{formatDate(invoice.dueDate)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="border-t border-gray-200 pt-6 mt-6">
          <button
            onClick={handlePay}
            disabled={isProcessing}
            className="btn-primary w-full text-lg py-3"
          >
            {isProcessing ? 'Processing...' : `Pay ${formatCurrency(invoice.amountCents)}`}
          </button>
          <p className="text-xs text-gray-500 text-center mt-3">
            Secure payment powered by Stripe. Card processing fee applies.
          </p>
        </div>
      </div>

      <div className="card bg-gray-50">
        <h3 className="font-semibold text-gray-900 mb-2">Payment Breakdown</h3>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1 text-gray-600">Session fee</td>
              <td className="py-1 text-right">{formatCurrency(invoice.amountCents)}</td>
            </tr>
            <tr>
              <td className="py-1 text-gray-600">Card processing (Stripe)</td>
              <td className="py-1 text-right text-gray-500">
                ~{formatCurrency(invoice.stripeFeeCents)}
              </td>
            </tr>
            <tr>
              <td className="py-1 text-gray-600">Platform fee (1%)</td>
              <td className="py-1 text-right text-gray-500">
                {formatCurrency(invoice.platformFeeCents)}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-gray-500 mt-3">
          Processing fees are deducted from the payment. You pay only the session fee shown above.
        </p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: WebInvoice['status'] }) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-700',
    overdue: 'bg-red-100 text-red-700',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
