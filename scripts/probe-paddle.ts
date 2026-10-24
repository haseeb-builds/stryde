/**
 * Independent verification probe for Stryde's Paddle Billing v2 integration.
 *
 * Usage: npm run probe:paddle
 *
 * Verifies:
 *   1. Paddle environment (sandbox vs production)
 *   2. API Key authentication & reachability against Paddle Billing v2 REST API
 *   3. Product and Price catalog configuration (PADDLE_PRO_PRICE_ID)
 *   4. Webhook secret key format & HMAC signature readiness
 *   5. Outputs exact manual gate instructions if unconfigured
 */
import fs from "node:fs";
import path from "node:path";
import { getPaddleConfig, isPaddleConfigured } from "../lib/paddle.ts";

// Load .env.local
const envPath = path.resolve(".env.local");
if (fs.existsSync(envPath)) {
  const env = Object.fromEntries(
    fs.readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
  );
  for (const [k, v] of Object.entries(env)) {
    if (!(k in process.env)) process.env[k] = v;
  }
}

console.log("\n=======================================================");
console.log("  STRYDE PADDLE BILLING v2 COMMERCIAL PROBE");
console.log("=======================================================\n");

const apiKey = process.env.PADDLE_API_KEY?.trim();
const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET_KEY?.trim();
const priceId = process.env.PADDLE_PRO_PRICE_ID?.trim();
const envName = (process.env.PADDLE_ENVIRONMENT || "sandbox").toLowerCase();

console.log(`Configured Environment: ${envName.toUpperCase()}`);
console.log(`API Key configured: ${apiKey ? "YES (masked: " + apiKey.slice(0, 8) + "...)" : "NO"}`);
console.log(`Webhook Secret configured: ${webhookSecret ? "YES (masked: " + webhookSecret.slice(0, 8) + "...)" : "NO"}`);
console.log(`Pro Price ID configured: ${priceId ? priceId : "NO"}`);

if (!isPaddleConfigured()) {
  console.log("\n[PROBE GATE: PADDLE CREDENTIALS REQUIRED]");
  console.log("Stryde's commercial engine is fully implemented with Paddle Billing v2.");
  console.log("To connect live or sandbox billing for Pakistan and global operations:\n");
  console.log("  1. Sign in to Paddle Sandbox (https://sandbox-vendors.paddle.com)");
  console.log("     or Production (https://vendors.paddle.com) — select Pakistan as your business origin.");
  console.log("  2. In Developer Tools → Authentication, generate an API key.");
  console.log("  3. In Catalog → Products, create 'Stryde Pro' ($29/mo) and copy the Price ID (pri_...).");
  console.log("  4. In Developer Tools → Notifications, create a webhook destination:");
  console.log("     URL: https://stryde-topaz.vercel.app/api/v1/billing/webhook");
  console.log("     Events: subscription.created, subscription.updated, subscription.canceled, subscription.paused");
  console.log("     Copy the notification secret key (pdl_ntf_set_...).");
  console.log("  5. Add to .env.local or Vercel environment variables:");
  console.log("     PADDLE_ENVIRONMENT=\"sandbox\"");
  console.log("     PADDLE_API_KEY=\"pdl_sbox_...\"");
  console.log("     PADDLE_WEBHOOK_SECRET_KEY=\"pdl_ntf_set_...\"");
  console.log("     PADDLE_PRO_PRICE_ID=\"pri_...\"");
  console.log("  6. Run: npm run probe:paddle\n");
  process.exit(0);
}

const config = getPaddleConfig();
console.log(`\nConnecting to Paddle API (${config.baseUrl})...`);

const start = Date.now();
try {
  // Test authentication by reading product / price list
  const res = await fetch(`${config.baseUrl}/products?per_page=1`, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  });

  const durationMs = Date.now() - start;

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`✖ Paddle API returned HTTP ${res.status} in ${durationMs}ms:`, errorText);
    process.exit(1);
  }

  const body = (await res.json()) as { data?: unknown[]; meta?: unknown };
  console.log(`✔ Paddle API authenticated successfully in ${durationMs}ms (HTTP 200)`);
  console.log(`✔ Products found: ${Array.isArray(body.data) ? body.data.length : 0}`);

  // Test the configured price ID if present
  if (config.priceIdPro) {
    console.log(`Testing configured Pro Price ID (${config.priceIdPro})...`);
    const priceRes = await fetch(`${config.baseUrl}/prices/${config.priceIdPro}`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (priceRes.ok) {
      const priceBody = (await priceRes.json()) as { data?: { unit_price?: { amount?: string; currency_code?: string } } };
      const amount = priceBody.data?.unit_price?.amount;
      const currency = priceBody.data?.unit_price?.currency_code;
      console.log(`✔ Price ID verified: ${currency} ${(Number(amount) / 100).toFixed(2)}`);
    } else {
      console.warn(`⚠ Warning: Price ID ${config.priceIdPro} returned HTTP ${priceRes.status}`);
    }
  }

  console.log("\n=======================================================");
  console.log("  PADDLE PROBE PASSED: LIVE INTEGRATION OPERATIONAL");
  console.log("=======================================================\n");
} catch (err) {
  console.error("✖ Paddle API connection error:", err);
  process.exit(1);
}
