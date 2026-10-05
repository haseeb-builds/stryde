# Paid Access — Activation Steps

Status: product-side architecture complete; billing activation is a human step.

## Honesty rule

Stryde never pretends payment works. While billing credentials are absent:

- `POST /api/v1/billing/checkout` returns **503** with
  `"Billing is not configured yet."` — it does not fake success;
- the founding-access strip tells the user exactly that;
- no claim of "verified" or "live" billing appears anywhere in the product or docs.

## What is already built

- `POST /api/v1/billing/checkout` — creates a real Stripe Checkout
  subscription session via platform-native `fetch` when credentials exist;
  `client_reference_id` and subscription metadata carry the Stryde owner id.
- `PAID_CTA_CLICK` funnel event is recorded when the CTA is used, so demand
  is measurable before activation.
- The founding-access CTA surface on the home page.

## Exact human activation steps

1. Create a Stripe account (or use an existing one) and a product with a
   recurring monthly price; copy its `price_...` id.
2. Add two environment variables to the Vercel project (Production):
   - `STRIPE_SECRET_KEY` — the live-mode secret key (`sk_live_...`);
   - `STRIPE_PRICE_ID` — the founding-tier price id (`price_...`);
   - confirm `NEXT_PUBLIC_SITE_URL` is the production origin.
3. Redeploy (Vercel re-reads env at build/runtime).
4. Verify honestly: `curl -X POST <prod>/api/v1/billing/checkout` with a real
   bearer token must return a `checkout_url` that opens Stripe Checkout.
5. In Stripe, configure the webhook endpoint if subscription state should
   feed back into Stryde (not required for the checkout path itself).

## Before activation

The funnel count for `PAID_CTA_CLICK` tells you how many users tried to pay.
A count above zero with billing unconfigured is demand, recorded honestly.
