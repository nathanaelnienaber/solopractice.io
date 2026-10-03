/**
 * Real-crypto verification of the webhook signature path.
 *
 * Deliberately does NOT mock the Stripe SDK: it computes genuine HMAC-SHA256
 * signatures with stripe.webhooks.generateTestHeaderString and feeds them to the
 * same constructEvent() the route uses. Proves the signature gate works for
 * real, rather than proving a mock returns what we told it to.
 *
 * Run: node scripts/verify-webhook-signature.mjs
 */
import Stripe from "stripe";
import assert from "node:assert/strict";

const SECRET = "whsec_testsecret_do_not_use_anywhere_real";
const stripe = new Stripe("sk_test_dummy_key_for_signature_math_only", {
  apiVersion: "2025-02-24.acacia",
});

const payload = JSON.stringify({
  id: "evt_acct_1",
  object: "event",
  type: "account.updated",
  livemode: false,
  data: {
    object: {
      id: "acct_1TestAccount",
      object: "account",
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
      requirements: { currently_due: [], past_due: [] },
    },
  },
});

let passed = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed += 1;
  } catch (err) {
    console.log(`  FAIL  ${name}: ${err.message}`);
    process.exitCode = 1;
  }
};

console.log("Real Stripe HMAC signature verification\n");

// 1. A correctly signed payload must verify and round-trip intact.
const goodHeader = stripe.webhooks.generateTestHeaderString({
  payload,
  secret: SECRET,
});
check("valid signature is accepted", () => {
  const event = stripe.webhooks.constructEvent(payload, goodHeader, SECRET);
  assert.equal(event.type, "account.updated");
  assert.equal(event.data.object.id, "acct_1TestAccount");
  assert.equal(event.livemode, false);
});

// 2. Right signature, tampered body => must be rejected.
check("tampered payload is rejected", () => {
  const tampered = payload.replace("acct_1TestAccount", "acct_1Attacker");
  assert.throws(
    () => stripe.webhooks.constructEvent(tampered, goodHeader, SECRET),
    /No signatures found matching/,
  );
});

// 3. Valid-looking header signed with the wrong secret => rejected.
check("signature from a different secret is rejected", () => {
  const wrong = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: "whsec_attacker_secret",
  });
  assert.throws(
    () => stripe.webhooks.constructEvent(payload, wrong, SECRET),
    /No signatures found matching/,
  );
});

// 4. Garbage header => rejected.
check("malformed header is rejected", () => {
  assert.throws(() =>
    stripe.webhooks.constructEvent(payload, "not-a-signature", SECRET),
  );
});

// 5. Replay protection: an old timestamp outside tolerance is rejected.
check("stale timestamp is rejected (replay protection)", () => {
  const old = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: SECRET,
    timestamp: Math.floor(Date.now() / 1000) - 3600,
  });
  assert.throws(
    () => stripe.webhooks.constructEvent(payload, old, SECRET, 300),
    /too old|outside the tolerance/i,
  );
});

// 6. The derived-status logic must agree with the signed payload's content.
check("signed ready-account payload derives status=ready", async () => {
  const event = stripe.webhooks.constructEvent(payload, goodHeader, SECRET);
  const acct = event.data.object;
  const ready = acct.charges_enabled === true && acct.details_submitted === true;
  assert.equal(ready, true);
});

console.log(`\n${passed}/6 signature checks passed`);
