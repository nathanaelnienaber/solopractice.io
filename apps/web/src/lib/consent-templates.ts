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
  version: "1.1.0-draft",
  isRequired: true,
  content: `
# Informed Consent for Mental Health Treatment

**⚠️ DRAFT DOCUMENT — NOT LEGAL ADVICE — FOR TESTING / GATE A ONLY ⚠️**

This is a **boilerplate scaffold** for product testing with fake clients. It is **not** attorney-reviewed, not jurisdiction-specific final copy, and **must not** be used with real clients until Gate B legal review for the therapist’s license(s) and practice locations. SoloPractice.io does not provide legal advice. The therapist remains solely responsible for meeting all clinical, licensing, and legal requirements.

---

## 1. Parties and Practice Information

I, **[CLIENT NAME]**, consent to mental health counseling / psychotherapy services provided by:

- **Therapist:** [THERAPIST NAME], [CREDENTIALS]
- **License(s):** [LICENSE TYPE] #[LICENSE NUMBER], issued by [LICENSING BOARD / JURISDICTION]
- **Additional licenses (if any):** [ADDITIONAL LICENSES OR “N/A”]
- **Practice name (if any):** [PRACTICE NAME]
- **Primary practice address:** [ADDRESS]
- **Phone:** [PHONE] · **Email:** [EMAIL]
- **Primary practice jurisdiction:** [PRIMARY STATE / TERRITORY / COUNTRY]

This form is intended as a one-stop draft for solo practitioners serving clients in the **United States and U.S. territories**, and for practices that may involve **cross-border or international** delivery (for example, the therapist living or traveling abroad while meeting clients who are located in various countries). Placeholders must be filled for the specific practice before any real-world use.

## 2. Nature of Services

I understand that:

- Services may include assessment, individual therapy, and related counseling appropriate to the therapist’s license and competence.
- Therapy is a collaborative process. Outcomes are not guaranteed. Progress depends on many factors, including participation between sessions.
- The therapist will discuss goals, approaches, risks, and alternatives in language I can understand, and I may ask questions at any time.
- Treatment approaches may include (as applicable): [TREATMENT APPROACHES — e.g., CBT, person-centered, trauma-informed].
- Session length is typically **[DURATION] minutes**. Frequency is typically **[FREQUENCY — e.g., weekly]** unless we agree otherwise.
- This practice does **not** provide emergency or crisis services as a substitute for emergency care (see §7).
- Medication management, medical diagnosis outside the therapist’s scope, and legal advocacy are **not** provided unless separately and clearly offered within license scope.

## 3. Confidentiality and Mandatory Exceptions

Information shared in therapy is generally confidential. Confidentiality is **not absolute**. The therapist may be required or permitted to disclose information when, among other situations:

1. **Child abuse or neglect** — Reasonable suspicion of abuse or neglect of a minor.
2. **Elder or dependent-adult abuse** — Reasonable suspicion of abuse, neglect, or exploitation of an elder or dependent adult.
3. **Danger to self** — Imminent risk of serious self-harm, including when emergency intervention is needed.
4. **Danger to others / duty to protect** — Credible threat of serious violence toward an identifiable person or the public, as required by applicable law.
5. **Court order or other legal process** — A valid court order, subpoena, or other legal requirement after any available legal protections are considered.
6. **Professional consultation / supervision** — Limited clinical consultation with colleagues without identifying details when possible; identifying disclosure only as permitted or required.
7. **Payment / operations** — Limited information as needed for billing, insurance/superbills (if used), practice operations, or platform features I use (for example, scheduling or invoicing), consistent with applicable privacy rules.
8. **Other disclosures required by the laws of the jurisdiction(s) that apply** — Including U.S. state/territory rules and, when services involve other countries, local mandatory-reporting or professional rules that may apply.

A separate **Limits of Confidentiality** form and **Notice of Privacy Practices** may provide additional detail. If anything here conflicts with those documents after attorney review, the attorney-approved versions control.

## 4. Fees, Payment, Cancellation, and Records Requests

- **Session fee:** [CURRENCY][FEE] per [DURATION]-minute session (or as otherwise agreed in writing).
- **Other fees (if any):** [OTHER FEES — e.g., late cancel, no-show, reports, letters — or “N/A”].
- **Payment due:** [PAYMENT TIMING — e.g., at time of service / upon invoice].
- **Accepted payment methods:** [PAYMENT METHODS].
- **Cancellation / no-show policy:** [CANCELLATION POLICY].
- **Insurance:** [INSURANCE POLICY — e.g., private pay only; superbills available upon request; or specific plan participation].
- **Unpaid balances:** [COLLECTION POLICY].
- **Records / copies:** Reasonable requests for records will be handled according to applicable law and practice policy: [RECORDS REQUEST POLICY].

I understand fees may change with reasonable notice: [FEE CHANGE NOTICE — e.g., 30 days].

## 5. Telehealth, Technology, and Privacy Basics

Services may be delivered in person, by video, by phone, or by other agreed electronic means (**telehealth**), when clinically appropriate and legally permitted.

I understand that:

- Telehealth has benefits (access, convenience) and limits (tech failures, fewer non-verbal cues, not ideal for all crises or conditions).
- I am responsible for joining from a reasonably private location and for the privacy of my own device, network, and surroundings.
- No electronic system is perfectly secure. The therapist will use reasonable safeguards; I will do the same on my side.
- Platform and tooling notes for this practice: [TELEHEALTH PLATFORM / TOOLS]. SoloPractice.io is used for client-facing operations such as consent e-sign, scheduling/reminders, and billing; **clinical session notes and recordings are not hosted as a clinical data lake on SoloPractice web servers** under the product’s stated design. This statement is about product architecture, not a HIPAA certification or legal guarantee.
- A separate **Telehealth Informed Consent** may apply when telehealth is used. Session audio recording, if any, requires a separate **Session Recording Consent**.

## 6. Jurisdiction, Licensing, and Cross-Border / International Practice

**Important:** Mental health practice is regulated by place. Licensure that is valid in one location does not automatically authorize practice everywhere.

I acknowledge that:

- The therapist’s license(s) and authority to practice are described in §1. I have been informed of the therapist’s **primary practice jurisdiction**: [PRIMARY STATE / TERRITORY / COUNTRY].
- If I am located in a **U.S. state or territory** different from the therapist’s license jurisdiction(s), or if either of us is **outside the United States**, additional rules may apply. Cross-border care may be restricted or prohibited depending on where I am physically located during sessions and where the therapist is licensed.
- **Client location during sessions:** I agree to tell the therapist my physical location (city/region/country) at the start of telehealth sessions, and to notify the therapist if I travel or relocate in a way that may affect legality of care: [CLIENT PRIMARY LOCATION].
- **Therapist location:** The therapist may live in, travel to, or temporarily work from: [THERAPIST LOCATION NOTES — e.g., U.S.-licensed; periodically abroad]. Living or traveling abroad does **not** by itself create a license to practice in every country where a client may be located.
- I understand that **emergency services, courts, and regulators** in the place where I am located (or where harm occurs) may be the relevant authorities in a crisis, which can differ from the therapist’s home jurisdiction.
- This draft does **not** create a representation that the therapist is licensed, insured, or authorized in every location where I might receive services. Lawful delivery of services in my location is a condition of ongoing care; if care cannot lawfully continue, we will discuss options (referral, pause, or other lawful alternatives).

Governing-law / venue placeholders for attorney review (not final): [GOVERNING LAW] · [DISPUTE VENUE].

## 7. Emergencies, Crises, and Limits of Care

This practice provides **outpatient / scheduled** mental health services. It is **not** an emergency clinic, hospital, or crisis hotline.

**If I am in immediate danger or having a medical or psychiatric emergency, I will call local emergency services first** (in the U.S., **911**), go to the nearest emergency department, or use local crisis resources — I will not wait for a reply from the therapist.

U.S. crisis resources (availability may vary by location):

- **988** Suicide & Crisis Lifeline (call or text)
- **Crisis Text Line:** text HOME to **741741**
- **Local crisis / mobile crisis:** [LOCAL CRISIS NUMBER OR RESOURCE]

International / non-U.S. clients: I will use the **local emergency number and crisis resources** where I am physically located: [INTERNATIONAL EMERGENCY NOTES — e.g., local equivalent of 911].

Between-session contact:

- Therapist response hours: [RESPONSE HOURS]
- Expected response time for non-urgent messages: [RESPONSE TIME]
- After-hours / weekend policy: [AFTER-HOURS POLICY]

**Limits of care:** The therapist may determine that this setting is not appropriate (for example, active crisis needing a higher level of care, services outside competence or license, or inability to practice lawfully where I am located). In that case, the therapist may decline, pause, or end services and, when feasible, discuss referrals.

**Emergency contact** (optional but strongly encouraged):

- Name: [EMERGENCY CONTACT NAME]
- Relationship: [RELATIONSHIP]
- Phone: [EMERGENCY CONTACT PHONE]
- I authorize the therapist to contact this person if there is a serious concern for my safety: [YES / NO / CONDITIONS].

## 8. Client Rights and Responsibilities

**I have the right to:**

- Ask questions about treatment, risks, benefits, and alternatives
- Participate in decisions about my care
- Refuse recommended interventions (with discussion of consequences)
- End therapy at any time
- Request my records as allowed by law
- File a complaint with the therapist and/or the applicable licensing board: [LICENSING BOARD CONTACT]
- Receive services free from discrimination and with respect for my dignity

**I agree to:**

- Provide accurate information needed for safe care (including location during telehealth)
- Attend sessions as scheduled or cancel per policy
- Pay fees as agreed
- Use emergency resources for crises rather than relying on routine messaging
- Maintain a reasonably private environment for telehealth when possible

## 9. Minors, Couples, and Third Parties (as applicable)

- If the client is a **minor** or otherwise lacks independent consent capacity, the legal guardian/authorized representative is: [GUARDIAN NAME / RELATIONSHIP]. Consent and confidentiality rules for minors vary by jurisdiction and will be explained as applicable: [MINOR CONSENT NOTES].
- **Couples/family** sessions (if offered) involve limits on individual confidentiality among participants: [COUPLES/FAMILY POLICY OR “N/A”].
- The therapist does not provide forensic evaluations or court testimony unless separately agreed in writing: [FORENSIC POLICY OR “N/A”].

## 10. Acknowledgment and Signatures

By signing below (including electronic signature), I acknowledge that:

1. I have read this Informed Consent (or had it read to me) in a language I understand.
2. I understand it is a **DRAFT / testing template** until replaced by attorney-approved practice documents.
3. I have had an opportunity to ask questions; my questions have been answered to my satisfaction.
4. I understand confidentiality limits, fees, telehealth/technology basics, emergency limits, and cross-border/licensing acknowledgments described above.
5. I voluntarily consent to mental health treatment with [THERAPIST NAME] under the terms described here, as filled in for this practice.

**Client / Authorized Representative signature:** ___________________________ **Date:** ________  
**Printed name:** [CLIENT NAME]  
**Relationship if signing for another:** [RELATIONSHIP OR “SELF”]

**Therapist acknowledgment:** I have reviewed this consent with the client (or representative) and provided an opportunity for questions.

**Therapist signature:** ___________________________ **Date:** ________  
**Printed name:** [THERAPIST NAME], [CREDENTIALS]

---

**⚠️ END OF DRAFT TEMPLATE — NOT LEGAL ADVICE — DO NOT USE WITH REAL CLIENTS WITHOUT ATTORNEY REVIEW (GATE B) ⚠️**

Other consent pack forms (separate): Notice of Privacy Practices; Telehealth Informed Consent; Session Recording Consent; Limits of Confidentiality & Emergency Procedures. This Informed Consent is the expanded “one-stop” treatment consent draft; those other forms remain separate pack items for Gate A testing.
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
  isRequired: true,
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

- All recordings are stored locally on the therapist's computer (not uploaded to SoloPractice servers)
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
