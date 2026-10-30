import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ORDERED_USER_TABLES } from "../lib/account-deletion.ts";

test("Privacy policy accurately reflects the verified user database table count", () => {
  const privacyPath = path.join(process.cwd(), "app/privacy/page.tsx");
  const privacyContent = fs.readFileSync(privacyPath, "utf-8");

  // Verify that ORDERED_USER_TABLES has exactly 40 tables
  assert.equal(
    ORDERED_USER_TABLES.length,
    40,
    `Expected 40 ordered user tables in lib/account-deletion.ts, got ${ORDERED_USER_TABLES.length}`,
  );

  // Privacy policy must state 40 verified tables, not outdated 30
  assert.ok(
    privacyContent.includes("40 verified user-scoped tables"),
    "Privacy policy must state '40 verified user-scoped tables'",
  );
  assert.ok(
    !privacyContent.includes("all 30 user-scoped tables"),
    "Privacy policy must not contain outdated reference to 30 tables",
  );
});

test("Privacy policy contains mandatory statutory disclosures", () => {
  const privacyPath = path.join(process.cwd(), "app/privacy/page.tsx");
  const privacyContent = fs.readFileSync(privacyPath, "utf-8");

  // 1. Paddle 7-year statutory financial retention
  assert.ok(
    privacyContent.includes("Statutory Financial Retention Exception"),
    "Must document statutory financial retention exception",
  );
  assert.ok(
    privacyContent.includes("7 years") && privacyContent.includes("HMRC"),
    "Must document 7-year HMRC/VAT statutory invoice retention",
  );

  // 2. Essential authentication tokens and cookies
  assert.ok(
    privacyContent.includes("sb-*-auth-token"),
    "Must disclose Supabase essential authentication session tokens",
  );
  assert.ok(
    privacyContent.includes("Cookies & Local Storage"),
    "Must contain cookies and local storage disclosures",
  );

  // 3. Generative AI transient processing and zero public training
  assert.ok(
    privacyContent.includes("Zero Public Model Training"),
    "Must explicitly state zero public model training under commercial enterprise terms",
  );
  assert.ok(
    privacyContent.includes("Transient In-Memory Processing"),
    "Must state transient processing and lack of permanent training retention",
  );

  // 4. Data Subject Rights (DSAR)
  assert.ok(
    privacyContent.includes("Data Subject Rights (DSAR)"),
    "Must disclose GDPR/CCPA Data Subject Rights",
  );
  assert.ok(
    privacyContent.includes("30-day"),
    "Must specify 30-day statutory timeline for DSAR responses",
  );
  assert.ok(
    privacyContent.includes("privacy@stryde.dev"),
    "Must provide verified contact email for privacy and DSAR requests",
  );

  // 5. Protection of minors (COPPA / GDPR Art. 8)
  assert.ok(
    privacyContent.includes("Protection of Minors (COPPA & GDPR Art. 8)"),
    "Must include protection of minors section",
  );
  assert.ok(
    privacyContent.includes("13") && privacyContent.includes("16"),
    "Must specify age thresholds (13+ US, 16+ EEA/UK)",
  );
});

test("Terms of Service contains required pre-launch liability protections", () => {
  const termsPath = path.join(process.cwd(), "app/terms/page.tsx");
  const termsContent = fs.readFileSync(termsPath, "utf-8");

  // 1. Eligibility & Minimum Age
  assert.ok(
    termsContent.includes("Minimum Age Requirement"),
    "Terms must define minimum age requirement",
  );
  assert.ok(
    termsContent.includes("13 years old") && termsContent.includes("16 years old"),
    "Terms must specify 13+ US and 16+ EEA/UK thresholds",
  );

  // 2. Strict No-Professional-Advice Disclaimers
  assert.ok(
    termsContent.includes("Strictly Not Professional Advice"),
    "Must emphasize AI is not professional advice",
  );
  assert.ok(
    termsContent.includes("medical") &&
      termsContent.includes("legal") &&
      termsContent.includes("investment"),
    "Must enumerate medical, legal, and financial disclaimers",
  );

  // 3. Limitation of Liability
  assert.ok(
    termsContent.includes("Disclaimer of Warranties & Limitation of Liability"),
    "Must contain warranty disclaimers and liability caps",
  );
  assert.ok(
    termsContent.includes("AS IS") && termsContent.includes("AS AVAILABLE"),
    "Must state AS IS and AS AVAILABLE disclaimers",
  );

  // 4. Dispute Resolution & Governing Law
  assert.ok(
    termsContent.includes("Governing Law & Dispute Resolution"),
    "Must contain governing law and dispute resolution clause",
  );
  assert.ok(
    termsContent.includes("Delaware"),
    "Must specify Delaware governing law",
  );
  assert.ok(
    termsContent.includes("Arbitration & Class Action Waiver"),
    "Must include binding arbitration and class action waiver",
  );

  // 5. Acceptable Use Policy
  assert.ok(
    termsContent.includes("prompt injection") || termsContent.includes("jailbreaking"),
    "Must prohibit prompt injection and adversarial attacks",
  );
  assert.ok(
    termsContent.includes("row-level tenant security") ||
      termsContent.includes("multi-tenant row-level security"),
    "Must prohibit attempts to bypass multi-tenant security",
  );
});

test("Landing page and workspace surface legal links, self-serve account deletion, and clean customer copy", () => {
  const homePath = path.join(process.cwd(), "app/page.tsx");
  const homeContent = fs.readFileSync(homePath, "utf-8");

  // 1. Links to Terms of Service and Privacy Policy (required for Paddle MoR & GDPR)
  assert.ok(
    homeContent.includes('href="/terms"') && homeContent.includes('href="/privacy"'),
    "Home page must link visibly to /terms and /privacy",
  );

  // 2. Self-serve account deletion UI wired to DELETE /api/v1/user/account
  assert.ok(
    homeContent.includes("/api/v1/user/account") && homeContent.includes('method: "DELETE"'),
    "Authenticated workspace must provide self-serve account deletion UI wired to DELETE /api/v1/user/account",
  );

  // 3. No leaked internal founder payout notes or internal repo script names
  assert.ok(
    !homeContent.includes("Payoneer") && !homeContent.includes("supporting Pakistani"),
    "Customer-facing pricing copy must not leak internal founder payout notes",
  );
  assert.ok(
    !homeContent.includes("probe-research") && !homeContent.includes("probe-paddle"),
    "Public demo scenarios must not leak internal repository script names",
  );
});
