/**
 * LMHC Consent Form Templates
 *
 * ⚠️  DRAFT - NOT LEGAL ADVICE ⚠️
 *
 * These are placeholder boilerplate forms for development and testing.
 * They must be reviewed by an attorney before use with real clients.
 * Use only with fake/test clients until legal review is complete.
 */

import type { ConsentType } from "@solopractice/shared";
import { createHash } from "crypto";

export interface ConsentTemplate {
  type: ConsentType;
  title: string;
  version: string;
  content: string;
  isRequired: boolean;
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export const INFORMED_CONSENT: ConsentTemplate = {
  type: "informed_consent",
  title: "Informed Consent for Treatment",
  version: "1.0.0-draft",
  isRequired: true,
  content: `
# Informed Consent for Mental Health Treatment

**⚠️ DRAFT DOCUMENT - NOT LEGAL ADVICE - FOR TESTING ONLY ⚠️**

## Nature of Services

I understand that I am consenting to participate in mental health counseling services provided by [THERAPIST NAME], [CREDENTIALS], License #[LICENSE NUMBER].

## Confidentiality

Information shared in therapy is confidential with the following exceptions required by law:
- Suspected child abuse or neglect
- Suspected elder abuse or neglect
- Threat of serious harm to self or others
- Court order

## Fees and Payment

- Session fee: $[FEE] per [DURATION]-minute session
- Cancellation policy: [CANCELLATION POLICY]
- Payment is due at time of service unless other arrangements are made

## Emergency Procedures

In case of emergency, contact:
- 911
- National Suicide Prevention Lifeline: 988
- Crisis Text Line: Text HOME to 741741

## Client Rights

You have the right to:
- Ask questions about your treatment
- Refuse any recommended treatment
- End treatment at any time
- Request your records

## Acknowledgment

By signing below, I acknowledge that I have read and understand this consent form, have had my questions answered, and consent to participate in mental health services.

---

**⚠️ THIS IS A DRAFT TEMPLATE FOR DEVELOPMENT PURPOSES ONLY ⚠️**
**Do not use with real clients without attorney review.**
`,
};

export const PRIVACY_PRACTICES: ConsentTemplate = {
  type: "privacy_practices",
  title: "Notice of Privacy Practices",
  version: "1.0.0-draft",
  isRequired: true,
  content: `
# Notice of Privacy Practices

**⚠️ DRAFT DOCUMENT - NOT LEGAL ADVICE - FOR TESTING ONLY ⚠️**

## How Your Health Information May Be Used

Your Protected Health Information (PHI) may be used and disclosed for:
- Treatment: To provide, coordinate, or manage your mental health care
- Payment: To obtain payment for services rendered
- Healthcare Operations: For quality assessment and improvement activities

## Your Rights Regarding Your Health Information

You have the right to:
- Inspect and copy your health record
- Request amendments to your record
- Request restrictions on certain uses
- Receive an accounting of disclosures
- Request confidential communications
- File a complaint if you believe your privacy rights have been violated

## Our Duties

We are required by law to:
- Maintain the privacy of your health information
- Provide you with notice of our legal duties and privacy practices
- Notify you if there is a breach of your unsecured health information

## Contact Information

For questions about this notice or to file a complaint:
[THERAPIST NAME]
[ADDRESS]
[PHONE]
[EMAIL]

---

**⚠️ THIS IS A DRAFT TEMPLATE FOR DEVELOPMENT PURPOSES ONLY ⚠️**
**Do not use with real clients without attorney review.**
`,
};

export const TELEHEALTH_CONSENT: ConsentTemplate = {
  type: "telehealth_consent",
  title: "Telehealth Informed Consent",
  version: "1.0.0-draft",
  isRequired: false,
  content: `
# Telehealth Informed Consent

**⚠️ DRAFT DOCUMENT - NOT LEGAL ADVICE - FOR TESTING ONLY ⚠️**

## What is Telehealth?

Telehealth involves the use of electronic communications to enable mental health services at a distance. This may include video conferencing, telephone, and secure messaging.

## Benefits and Limitations

**Benefits:**
- Increased access to care
- Convenience of receiving services from home
- Reduced travel time and costs

**Limitations:**
- Technology may fail or be interrupted
- Not appropriate for all conditions or crises
- Reduced ability to observe non-verbal cues

## Privacy and Security

- Sessions will be conducted on HIPAA-compliant platforms
- I will be in a private location during sessions
- I understand that I am responsible for the privacy of my own location

## Emergency Procedures

- I will provide my physical location at the start of each session
- In case of emergency, local emergency services will be contacted
- I have identified a local emergency contact: [EMERGENCY CONTACT]

## Acknowledgment

By signing below, I consent to participate in telehealth services and acknowledge that I have been informed of the benefits and limitations.

---

**⚠️ THIS IS A DRAFT TEMPLATE FOR DEVELOPMENT PURPOSES ONLY ⚠️**
**Do not use with real clients without attorney review.**
`,
};

export const RECORDING_CONSENT: ConsentTemplate = {
  type: "recording_consent",
  title: "Session Recording Consent",
  version: "1.0.0-draft",
  isRequired: true,
  content: `
# Consent for Session Recording

**⚠️ DRAFT DOCUMENT - NOT LEGAL ADVICE - FOR TESTING ONLY ⚠️**

## Purpose of Recording

I understand that my therapist may audio record our sessions for the following purposes:
- To assist with accurate clinical documentation
- To review session content for quality of care

## Storage and Security

- All recordings are stored locally on the therapist's secure, encrypted device
- Recordings are NEVER uploaded to cloud services or external servers
- Recordings are maintained according to state record retention requirements
- Recordings will be destroyed after the retention period

## Your Rights

- You may withdraw this consent at any time
- You may request that specific sessions not be recorded
- Withdrawing consent will not affect your treatment

## Confidentiality

Recordings are subject to the same confidentiality protections as your therapy records. They will not be shared without your written consent except as required by law.

## Acknowledgment

By signing below, I voluntarily consent to the audio recording of my therapy sessions under the conditions described above.

---

**⚠️ THIS IS A DRAFT TEMPLATE FOR DEVELOPMENT PURPOSES ONLY ⚠️**
**Do not use with real clients without attorney review.**
`,
};

export const LIMITS_OF_CONFIDENTIALITY: ConsentTemplate = {
  type: "limits_of_confidentiality",
  title: "Limits of Confidentiality & Emergency Procedures",
  version: "1.0.0-draft",
  isRequired: true,
  content: `
# Limits of Confidentiality & Emergency Procedures

**⚠️ DRAFT DOCUMENT - NOT LEGAL ADVICE - FOR TESTING ONLY ⚠️**

## Confidentiality

What you share in therapy is confidential. However, there are legal and ethical limits to confidentiality:

## Mandatory Exceptions

I am required by law to break confidentiality if:
1. **Child Abuse/Neglect**: I have reason to believe a child is being abused or neglected
2. **Elder/Dependent Adult Abuse**: I have reason to believe an elder or dependent adult is being abused
3. **Danger to Self**: You pose an imminent danger to yourself
4. **Danger to Others**: You make a credible threat of violence against a specific person
5. **Court Order**: A judge orders disclosure of records

## Emergency Contact Information

In case of emergency, please provide the following:

- **Emergency Contact Name**: _______________
- **Relationship**: _______________
- **Phone**: _______________

## Crisis Resources

- **911**: Life-threatening emergencies
- **988**: Suicide and Crisis Lifeline (call or text)
- **Crisis Text Line**: Text HOME to 741741
- **Local Crisis Center**: [LOCAL NUMBER]

## Acknowledgment

By signing below, I acknowledge that I understand the limits of confidentiality and have been provided with emergency resources.

---

**⚠️ THIS IS A DRAFT TEMPLATE FOR DEVELOPMENT PURPOSES ONLY ⚠️**
**Do not use with real clients without attorney review.**
`,
};

export const ALL_CONSENT_TEMPLATES: ConsentTemplate[] = [
  INFORMED_CONSENT,
  PRIVACY_PRACTICES,
  TELEHEALTH_CONSENT,
  RECORDING_CONSENT,
  LIMITS_OF_CONFIDENTIALITY,
];

export const REQUIRED_CONSENT_TEMPLATES = ALL_CONSENT_TEMPLATES.filter(
  (t) => t.isRequired
);

export function getTemplateHash(template: ConsentTemplate): string {
  return hashContent(template.content + template.version);
}

export function getTemplateByType(type: ConsentType): ConsentTemplate | undefined {
  return ALL_CONSENT_TEMPLATES.find((t) => t.type === type);
}
