'use client';

import { useState } from 'react';
import type { ConsentType } from '@solopractice/shared';

const CONSENT_FORMS: Array<{
  type: ConsentType;
  title: string;
  description: string;
}> = [
  {
    type: 'informed_consent',
    title: 'Informed Consent for Treatment',
    description: 'Agreement to participate in mental health treatment services.',
  },
  {
    type: 'privacy_notice',
    title: 'Notice of Privacy Practices',
    description: 'Information about how your health information is used and protected.',
  },
  {
    type: 'recording_consent',
    title: 'Session Recording Consent',
    description: 'Permission to record sessions for note-taking purposes.',
  },
  {
    type: 'limits_of_confidentiality',
    title: 'Limits of Confidentiality',
    description: 'Understanding of when confidentiality may be limited by law.',
  },
  {
    type: 'telehealth',
    title: 'Telehealth Consent',
    description: 'Agreement for remote/video session services (if applicable).',
  },
];

export default function ConsentPage({ params }: { params: { token: string } }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [signatures, setSignatures] = useState<Record<ConsentType, string>>({} as never);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const currentForm = CONSENT_FORMS[currentStep];

  const handleSign = async (signature: string) => {
    if (!currentForm) return;

    setSignatures((prev) => ({
      ...prev,
      [currentForm.type]: signature,
    }));

    if (currentStep < CONSENT_FORMS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Submit all consents
      setIsSubmitting(true);
      try {
        // In production, this would submit to the API
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setIsComplete(true);
      } catch (error) {
        console.error('Failed to submit consents:', error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  if (isComplete) {
    return (
      <div className="card text-center py-12">
        <div className="text-6xl mb-4">✓</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">All Consents Completed</h2>
        <p className="text-gray-600 mb-6">
          Thank you for completing your intake forms. Your therapist will be notified and
          you&apos;re all set for your first session.
        </p>
        <p className="text-sm text-gray-500">
          You can close this page. You&apos;ll receive a reminder before your appointment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Consent Forms</h2>
          <span className="text-sm text-gray-500">
            {currentStep + 1} of {CONSENT_FORMS.length}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-200 rounded-full mb-6">
          <div
            className="h-full bg-primary-600 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / CONSENT_FORMS.length) * 100}%` }}
          />
        </div>

        {/* Form list */}
        <div className="space-y-2 mb-6">
          {CONSENT_FORMS.map((form, index) => (
            <div
              key={form.type}
              className={`flex items-center gap-3 p-2 rounded ${
                index === currentStep
                  ? 'bg-primary-50 text-primary-700'
                  : index < currentStep
                    ? 'text-green-700'
                    : 'text-gray-400'
              }`}
            >
              <span>
                {index < currentStep ? '✓' : index === currentStep ? '●' : '○'}
              </span>
              <span className={index === currentStep ? 'font-medium' : ''}>
                {form.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {currentForm && (
        <ConsentForm
          title={currentForm.title}
          description={currentForm.description}
          type={currentForm.type}
          onSign={handleSign}
          isSubmitting={isSubmitting}
          isLast={currentStep === CONSENT_FORMS.length - 1}
        />
      )}

      <div className="card bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">Important Notice</h3>
        <p className="text-sm text-blue-800">
          These consent forms are draft templates for demonstration purposes only. Before using
          with real clients, please have an attorney review them for compliance with your
          state&apos;s requirements and your specific license type.
        </p>
      </div>
    </div>
  );
}

function ConsentForm({
  title,
  description,
  type,
  onSign,
  isSubmitting,
  isLast,
}: {
  title: string;
  description: string;
  type: ConsentType;
  onSign: (signature: string) => void;
  isSubmitting: boolean;
  isLast: boolean;
}) {
  const [signature, setSignature] = useState('');
  const [agreed, setAgreed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (signature && agreed) {
      onSign(signature);
      setSignature('');
      setAgreed(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-4">{description}</p>

      {/* Consent content - boilerplate placeholder */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6 max-h-64 overflow-y-auto text-sm text-gray-700">
        <ConsentContent type={type} />
      </div>

      <div className="space-y-4">
        <div>
          <label className="form-label">Type your full legal name to sign</label>
          <input
            type="text"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            className="form-input"
            placeholder="Your full legal name"
            required
          />
        </div>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1"
            required
          />
          <span className="text-sm text-gray-700">
            I have read and understand this document. I agree to its terms.
          </span>
        </label>

        <button
          type="submit"
          disabled={!signature || !agreed || isSubmitting}
          className="btn-primary w-full"
        >
          {isSubmitting
            ? 'Submitting...'
            : isLast
              ? 'Complete All Consents'
              : 'Sign & Continue'}
        </button>
      </div>
    </form>
  );
}

function ConsentContent({ type }: { type: ConsentType }) {
  const content: Record<ConsentType, React.ReactNode> = {
    informed_consent: (
      <>
        <h4 className="font-semibold mb-2">INFORMED CONSENT FOR TREATMENT (DRAFT)</h4>
        <p className="mb-2">
          I, the undersigned client, consent to participate in mental health treatment
          provided by the therapist. I understand that:
        </p>
        <ul className="list-disc ml-4 space-y-1">
          <li>Treatment will involve talk therapy and may include various therapeutic approaches.</li>
          <li>I have the right to ask questions about my treatment at any time.</li>
          <li>I may discontinue treatment at any time.</li>
          <li>Payment is due at the time of service unless other arrangements have been made.</li>
          <li>Cancellations require 24-hour notice to avoid a cancellation fee.</li>
        </ul>
        <p className="mt-2 text-xs text-gray-500 italic">
          [DRAFT - Requires attorney review before use with actual clients]
        </p>
      </>
    ),
    privacy_notice: (
      <>
        <h4 className="font-semibold mb-2">NOTICE OF PRIVACY PRACTICES (DRAFT)</h4>
        <p className="mb-2">
          This notice describes how health information about you may be used and disclosed.
        </p>
        <ul className="list-disc ml-4 space-y-1">
          <li>Your health information is protected by federal and state privacy laws.</li>
          <li>Information may be used for treatment, payment, and healthcare operations.</li>
          <li>We will not share your information without your written consent except as permitted by law.</li>
          <li>You have the right to access your records and request corrections.</li>
          <li>Session notes, recordings, and clinical documentation are stored only on the therapist&apos;s local device.</li>
        </ul>
        <p className="mt-2 text-xs text-gray-500 italic">
          [DRAFT - Requires attorney review before use with actual clients]
        </p>
      </>
    ),
    recording_consent: (
      <>
        <h4 className="font-semibold mb-2">SESSION RECORDING CONSENT (DRAFT)</h4>
        <p className="mb-2">
          I understand and consent to the following regarding session recordings:
        </p>
        <ul className="list-disc ml-4 space-y-1">
          <li>Sessions may be recorded for the purpose of creating accurate session notes.</li>
          <li>All recordings are stored ONLY on the therapist&apos;s local device.</li>
          <li>Recordings are NEVER uploaded to any cloud service or web server.</li>
          <li>Recordings are used solely for transcription and note-taking purposes.</li>
          <li>I may revoke this consent at any time.</li>
        </ul>
        <p className="mt-2 text-xs text-gray-500 italic">
          [DRAFT - Requires attorney review before use with actual clients]
        </p>
      </>
    ),
    limits_of_confidentiality: (
      <>
        <h4 className="font-semibold mb-2">LIMITS OF CONFIDENTIALITY (DRAFT)</h4>
        <p className="mb-2">
          While your therapy sessions are confidential, there are legal exceptions:
        </p>
        <ul className="list-disc ml-4 space-y-1">
          <li>If you pose an imminent danger to yourself or others.</li>
          <li>If there is suspected abuse or neglect of a child, elder, or dependent adult.</li>
          <li>If required by a court order.</li>
          <li>If necessary to collect fees owed (limited information only).</li>
          <li>If you waive confidentiality in writing.</li>
        </ul>
        <p className="mt-2 text-xs text-gray-500 italic">
          [DRAFT - Requires attorney review before use with actual clients]
        </p>
      </>
    ),
    telehealth: (
      <>
        <h4 className="font-semibold mb-2">TELEHEALTH CONSENT (DRAFT)</h4>
        <p className="mb-2">
          I consent to participate in therapy sessions conducted via video/telephone:
        </p>
        <ul className="list-disc ml-4 space-y-1">
          <li>I understand telehealth involves electronic communication.</li>
          <li>I will ensure I am in a private location during sessions.</li>
          <li>I understand there are limitations to telehealth compared to in-person sessions.</li>
          <li>Technical difficulties may interrupt sessions; we will attempt to reconnect.</li>
          <li>I have an emergency contact available if needed during telehealth sessions.</li>
        </ul>
        <p className="mt-2 text-xs text-gray-500 italic">
          [DRAFT - Requires attorney review before use with actual clients]
        </p>
      </>
    ),
  };

  return content[type] || <p>Content not available.</p>;
}
