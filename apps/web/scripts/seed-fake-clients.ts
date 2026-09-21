/**
 * Seed Script: Create Fake Clients for Testing
 *
 * ⚠️ FOR DEVELOPMENT/TESTING ONLY
 *
 * This script creates:
 * - 1 test therapist
 * - 3 fake clients with various consent states
 *
 * Usage:
 *   pnpm tsx scripts/seed-fake-clients.ts
 *
 * Requires:
 *   DATABASE_URL in .env
 */

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { nanoid } from "nanoid";
import * as schema from "../src/db/schema";

const THERAPIST_EMAIL = "therapist@test.local";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL not set. Copy .env.example to .env and configure.");
    process.exit(1);
  }

  console.log("🌱 Seeding fake clients for testing...\n");

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql, { schema });

  // Create or get test therapist
  let therapist = await db.query.therapists.findFirst({
    where: (t, { eq }) => eq(t.email, THERAPIST_EMAIL),
  });

  if (!therapist) {
    const [newTherapist] = await db
      .insert(schema.therapists)
      .values({
        id: nanoid(21),
        email: THERAPIST_EMAIL,
        firstName: "Test",
        lastName: "Therapist",
        credentials: "LMHC",
        licenseState: "FL",
        practiceName: "Test Practice",
      })
      .returning();
    therapist = newTherapist;
    console.log("✅ Created test therapist:", THERAPIST_EMAIL);
  } else {
    console.log("ℹ️  Using existing therapist:", THERAPIST_EMAIL);
  }

  if (!therapist) {
    console.error("❌ Failed to create/find therapist");
    process.exit(1);
  }

  // Fake clients to create
  const fakeClients = [
    {
      firstName: "Alice",
      lastName: "Testclient",
      email: "alice@fake.local",
      phone: "+1 555 111 1111",
      description: "All consents signed — ready for recording",
      signAllConsents: true,
    },
    {
      firstName: "Bob",
      lastName: "Nopermission",
      email: "bob@fake.local",
      phone: "+1 555 222 2222",
      description: "No consents signed — recording blocked",
      signAllConsents: false,
    },
    {
      firstName: "Carol",
      lastName: "Partialconsent",
      email: "carol@fake.local",
      phone: "+1 555 333 3333",
      description: "Some consents signed — pending recording consent",
      signAllConsents: "partial",
    },
  ];

  for (const fake of fakeClients) {
    // Check if client exists
    const existing = await db.query.clients.findFirst({
      where: (c, { eq }) => eq(c.email, fake.email),
    });

    if (existing) {
      console.log(`ℹ️  Skipping existing: ${fake.email}`);
      continue;
    }

    // Create client
    const clientId = nanoid(21);
    const magicLinkToken = nanoid(32);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await db.insert(schema.clients).values({
      id: clientId,
      therapistId: therapist.id,
      email: fake.email,
      firstName: fake.firstName,
      lastName: fake.lastName,
      phone: fake.phone,
      magicLinkToken,
      magicLinkExpiresAt: expiresAt,
    });

    console.log(`✅ Created fake client: ${fake.firstName} ${fake.lastName}`);
    console.log(`   Email: ${fake.email}`);
    console.log(`   Status: ${fake.description}`);
    console.log(`   Consent link: /client/consent/${magicLinkToken}`);

    // Create consents based on state
    if (fake.signAllConsents === true) {
      const consentTypes = [
        "informed_consent",
        "privacy_practices",
        "recording_consent",
        "limits_of_confidentiality",
      ] as const;

      for (const type of consentTypes) {
        await db.insert(schema.consents).values({
          id: nanoid(21),
          clientId,
          consentType: type,
          status: "signed",
          formVersionHash: "test-hash-v1",
          signedAt: new Date(),
          signatureData: `${fake.firstName} ${fake.lastName}`,
          ipAddress: "127.0.0.1",
          userAgent: "seed-script",
        });
      }
      console.log(`   ✓ All consents signed`);
    } else if (fake.signAllConsents === "partial") {
      // Sign some but not recording consent
      const partialTypes = ["informed_consent", "privacy_practices"] as const;

      for (const type of partialTypes) {
        await db.insert(schema.consents).values({
          id: nanoid(21),
          clientId,
          consentType: type,
          status: "signed",
          formVersionHash: "test-hash-v1",
          signedAt: new Date(),
          signatureData: `${fake.firstName} ${fake.lastName}`,
          ipAddress: "127.0.0.1",
          userAgent: "seed-script",
        });
      }
      console.log(`   ⚠️ Partial consents (missing recording consent)`);
    } else {
      console.log(`   ○ No consents signed`);
    }

    console.log("");
  }

  console.log("🎉 Seeding complete!\n");
  console.log("Next steps:");
  console.log("1. Start web: pnpm dev:web");
  console.log(`2. Sign in as: ${THERAPIST_EMAIL}`);
  console.log("3. View clients in dashboard");
  console.log("4. Start desktop: pnpm dev:desktop");
  console.log("5. Test recording with Alice (all consents signed)");
}

main().catch(console.error);
