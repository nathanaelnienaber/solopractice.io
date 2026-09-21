#!/usr/bin/env node

/**
 * Seed Fake Clients
 *
 * Creates fake/demo client data for testing.
 * WARNING: Use only for development/testing. Never use real patient data.
 */

const fakeClients = [
  {
    id: 'client_demo_001',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane.doe@example.com',
    phone: '555-0101',
    consentStatus: {
      informedConsent: true,
      privacyNotice: true,
      telehealth: true,
      recordingConsent: true,
      limitsOfConfidentiality: true,
      lastUpdated: new Date().toISOString(),
    },
    notes: 'Demo client - all consents complete',
  },
  {
    id: 'client_demo_002',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@example.com',
    phone: '555-0102',
    consentStatus: {
      informedConsent: true,
      privacyNotice: true,
      telehealth: false,
      recordingConsent: false, // Recording blocked
      limitsOfConfidentiality: true,
      lastUpdated: new Date().toISOString(),
    },
    notes: 'Demo client - missing recording consent (greyed out for recording)',
  },
  {
    id: 'client_demo_003',
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.johnson@example.com',
    phone: '555-0103',
    consentStatus: {
      informedConsent: false, // Basic consent missing
      privacyNotice: false,
      telehealth: false,
      recordingConsent: false,
      limitsOfConfidentiality: false,
      lastUpdated: new Date().toISOString(),
    },
    notes: 'Demo client - no consents (fully greyed out)',
  },
  {
    id: 'client_demo_004',
    firstName: 'Michael',
    lastName: 'Williams',
    email: 'michael.williams@example.com',
    phone: '555-0104',
    consentStatus: {
      informedConsent: true,
      privacyNotice: true,
      telehealth: true,
      recordingConsent: true,
      limitsOfConfidentiality: true,
      lastUpdated: new Date().toISOString(),
    },
    notes: 'Demo client - all consents, telehealth enabled',
  },
  {
    id: 'client_demo_005',
    firstName: 'Emily',
    lastName: 'Brown',
    email: 'emily.brown@example.com',
    phone: null,
    consentStatus: {
      informedConsent: true,
      privacyNotice: true,
      telehealth: false,
      recordingConsent: false,
      limitsOfConfidentiality: true,
      lastUpdated: new Date().toISOString(),
    },
    notes: 'Demo client - in-person only, no recording',
  },
];

const fakeSessions = [
  {
    clientId: 'client_demo_001',
    sessionDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 45,
    sessionType: 'individual',
    recordingStatus: 'completed',
    transcriptStatus: 'completed',
    soapStatus: 'finalized',
    soapNote: {
      subjective: 'Client reports improved mood since last session. Sleeping better, averaging 7 hours per night. Still experiencing some work-related anxiety.',
      objective: 'Client appeared relaxed, made good eye contact. Speech normal rate and rhythm. Affect congruent with stated mood.',
      assessment: 'Progress noted in sleep hygiene and overall mood. Work anxiety remains a focus area. Good engagement with CBT techniques.',
      plan: 'Continue weekly sessions. Introduce workplace boundary-setting strategies. Practice thought records for anxious situations.',
      finalized: true,
      finalizedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
  {
    clientId: 'client_demo_001',
    sessionDate: new Date().toISOString(),
    durationMinutes: 45,
    sessionType: 'individual',
    recordingStatus: 'none',
    transcriptStatus: 'none',
    soapStatus: 'none',
  },
  {
    clientId: 'client_demo_004',
    sessionDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 50,
    sessionType: 'telehealth',
    recordingStatus: 'completed',
    transcriptStatus: 'completed',
    soapStatus: 'draft',
    soapNote: {
      subjective: 'Client reports feeling overwhelmed with work deadlines.',
      objective: 'Video session, client in home office. Appeared tired but engaged.',
      assessment: 'Work stress elevated, coping strategies underutilized.',
      plan: 'Review stress management techniques, schedule follow-up in 1 week.',
      finalized: false,
    },
  },
];

const fakeInvoices = [
  {
    id: 'inv_demo_001',
    clientId: 'client_demo_001',
    amountCents: 15000,
    description: 'Individual therapy session - 45 minutes',
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'sent',
  },
  {
    id: 'inv_demo_002',
    clientId: 'client_demo_001',
    amountCents: 15000,
    description: 'Individual therapy session - 45 minutes',
    dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'paid',
    paidAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'inv_demo_003',
    clientId: 'client_demo_004',
    amountCents: 17500,
    description: 'Telehealth therapy session - 50 minutes',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'sent',
  },
];

function printSeedData() {
  console.log('='.repeat(60));
  console.log('SOLOPRACTICE FAKE CLIENT SEED DATA');
  console.log('='.repeat(60));
  console.log('\nWARNING: This is FAKE data for development/testing only.');
  console.log('Never use real patient information in seed scripts.\n');

  console.log('CLIENTS:');
  console.log('-'.repeat(60));
  fakeClients.forEach((client) => {
    const consentCount = Object.entries(client.consentStatus)
      .filter(([key, val]) => key !== 'lastUpdated' && val === true)
      .length;
    const recordingOk = client.consentStatus.recordingConsent ? '✓' : '✗';
    const selectable = client.consentStatus.informedConsent && client.consentStatus.privacyNotice;

    console.log(`\n${client.firstName} ${client.lastName} (${client.id})`);
    console.log(`  Email: ${client.email}`);
    console.log(`  Phone: ${client.phone || 'N/A'}`);
    console.log(`  Consents: ${consentCount}/5 complete`);
    console.log(`  Recording: ${recordingOk}`);
    console.log(`  Selectable: ${selectable ? 'Yes' : 'No (greyed out)'}`);
  });

  console.log('\n\nSESSIONS:');
  console.log('-'.repeat(60));
  fakeSessions.forEach((session) => {
    const client = fakeClients.find((c) => c.id === session.clientId);
    console.log(`\n${client?.firstName} ${client?.lastName} - ${new Date(session.sessionDate).toLocaleDateString()}`);
    console.log(`  Type: ${session.sessionType}, Duration: ${session.durationMinutes}min`);
    console.log(`  Recording: ${session.recordingStatus}, Transcript: ${session.transcriptStatus}, SOAP: ${session.soapStatus}`);
  });

  console.log('\n\nINVOICES:');
  console.log('-'.repeat(60));
  fakeInvoices.forEach((invoice) => {
    const client = fakeClients.find((c) => c.id === invoice.clientId);
    const amount = (invoice.amountCents / 100).toFixed(2);
    console.log(`\n${invoice.id} - ${client?.firstName} ${client?.lastName}`);
    console.log(`  Amount: $${amount}`);
    console.log(`  Status: ${invoice.status}`);
    console.log(`  Due: ${new Date(invoice.dueDate).toLocaleDateString()}`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('JSON OUTPUT (for importing):');
  console.log('='.repeat(60));
  console.log(JSON.stringify({ clients: fakeClients, sessions: fakeSessions, invoices: fakeInvoices }, null, 2));
}

// Export for programmatic use
module.exports = { fakeClients, fakeSessions, fakeInvoices };

// Run if called directly
if (require.main === module) {
  printSeedData();
}
