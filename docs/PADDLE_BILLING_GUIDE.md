# Paddle Billing Integration Guide for Stryde (Pakistan-First SaaS Architecture)

**Version:** 1.0  
**Updated:** 2026-10-24  
**Target:** Stryde Production Commercial Engine  

---

## 1. Why Paddle for Pakistan-Based SaaS Founders

Stripe does not currently support direct onboarding for business entities registered in Pakistan. Standard international merchant solutions often require expensive foreign Delaware/UK company formations.

**Paddle operates as a Merchant of Record (MoR)**:
- **Seller Eligibility:** Pakistan is officially supported for software, SaaS, and digital product creators.
- **Global Compliance & Taxes:** Paddle acts as the legal reseller, calculating and remitting global VAT, GST, and US state sales taxes in 200+ countries.
- **Payout Compatibility:** Directly supports:
  1. **Direct International Wire (SWIFT):** Directly to your local Pakistani bank account (Faysal Bank, HBL, Meezan Bank, Standard Chartered, UBL, etc.).
  2. **Payoneer:** Payouts sent to Payoneer balance, which can be withdrawn to Pakistani bank accounts or JazzCash.
- **Minimum Payout:** $100 / €100 / £100 monthly automatic threshold.

---

## 2. Stryde's Implemented Paddle Architecture

Stryde's billing is fully implemented and decoupled from runtime permissions:

```
[User UI: Upgrade] 
      │
      ▼
POST /api/v1/billing/checkout
      │ (authenticated via Supabase token)
      ▼
Paddle Billing v2 API (POST /transactions)
      │ (custom_data: { owner_user_id, plan_id })
      ▼
Returns { checkout_url }
      │
      ▼
User completes payment on Paddle Checkout
      │
      ▼
Paddle sends Webhook (HMAC-SHA256 'Paddle-Signature')
      │
      ▼
POST /api/v1/billing/webhook
      │
      ├── verifyPaddleWebhookSignature() [Replay & Drift Protected]
      ├── normalizePaddleSubscriptionEvent() [Maps status to ACTIVE/CANCELLED/PAST_DUE]
      ▼
Supabase trusted service role updates:
`public.subscription_state`
      │
      ▼
Entitlement Service (`lib/entitlement.ts`) resolves effective capacity:
`free` | `pro` | `max`
```

---

## 3. Step-by-Step Paddle Setup (Manual Founder Gate)

### Step 1: Sign Up on Paddle
1. Go to [https://www.paddle.com](https://www.paddle.com) and click **Sign Up**.
2. Select your account type: **SaaS / Digital Software**.
3. Country of registration: **Pakistan**.
4. Submit required KYC verification:
   - Government ID: Pakistani CNIC (Smart Card) or Passport.
   - Proof of Address: Utility bill or bank statement (past 3 months).
   - Product Website: `https://stryde-topaz.vercel.app` (or custom domain). Describe Stryde as an AI-powered persistent pursuit and productivity platform.

### Step 2: Configure Payout Method in Paddle
1. Navigate to **Payout settings**.
2. Select **Wire Transfer (SWIFT)**:
   - Provide your Pakistani bank account IBAN (PKxx...), Bank SWIFT Code, and Branch Name.
   - *OR* select **Payoneer** and link your Payoneer account email.

### Step 3: Create Products & Prices in Paddle Dashboard
1. Go to **Catalog** -> **Products**.
2. Create Product: **Stryde Pro Plan**.
   - Add recurring price (e.g. $29/month).
   - Copy the generated **Price ID** (starts with `pri_...`).
3. Create Product: **Stryde Max Plan** (optional for higher tiers).
   - Add recurring price (e.g. $79/month).
   - Copy the generated **Price ID**.

### Step 4: Generate API Key
1. In Paddle Dashboard, navigate to **Developer Tools** -> **Authentication**.
2. Click **Generate API Key**.
3. Name it `Stryde Production`.
4. Copy the API Key (starts with `pdl_...`).

### Step 5: Configure Webhook Destination
1. Go to **Developer Tools** -> **Notifications**.
2. Click **New Destination**.
3. Destination URL: `https://stryde-topaz.vercel.app/api/v1/billing/webhook`
4. Select Events:
   - `subscription.created`
   - `subscription.updated`
   - `subscription.canceled`
   - `subscription.paused`
   - `subscription.resumed`
   - `subscription.past_due`
   - `transaction.completed`
5. Save the destination and copy the **Notification Secret** (starts with `pndto_...`).

---

## 4. Environment Variables Reference

Add these keys to your `.env.local` and Vercel project environment settings:

```bash
# Paddle Billing Configuration
PADDLE_API_KEY="pdl_live_..."
PADDLE_WEBHOOK_SECRET="pndto_..."
PADDLE_PRICE_ID_PRO="pri_..."
PADDLE_PRICE_ID_MAX="pri_..."
# Set to 'sandbox' for sandbox testing, or 'production' for live sales:
PADDLE_ENVIRONMENT="production"
```

---

## 5. Testing & Verification

Stryde includes automated unit and integration tests for Paddle Billing:
```bash
npm test tests/paddle-billing.test.ts
```
Tests verify:
- Complete configuration detection and environment selection (`production` vs `sandbox`).
- Real HMAC-SHA256 `Paddle-Signature` generation and verification.
- Tamper detection (rejects modified payloads and wrong secrets).
- Replay attack rejection (enforces 300-second timestamp tolerance).
- Transaction creation with `owner_user_id` and custom metadata.
- Lifecycle status mapping (`active` -> `ACTIVE`, `past_due` -> `PAST_DUE`, `canceled` -> `CANCELLED`).
