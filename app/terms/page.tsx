import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Stryde",
  description: "Terms of service, generative AI usage terms, and billing policies for Stryde.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:px-8 sm:py-16">
        <header className="mb-12 border-b border-[var(--rule)] pb-6">
          <Link
            href="/"
            className="inline-flex items-center text-[13px] font-medium text-[var(--ink-secondary)] hover:text-[var(--ink)]"
          >
            ← Back to Stryde
          </Link>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-2 text-[14px] text-[var(--ink-muted)]">
            Last updated: October 27, 2026 · Effective immediately
          </p>
        </header>

        <article className="space-y-8 text-[14.5px] leading-relaxed text-[var(--ink-secondary)]">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Stryde (&quot;the Service&quot;), you agree to be bound by these Terms of Service
              and our Privacy Policy. If you do not agree to these terms, do not access or use the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">2. Generative AI Capabilities & Disclaimers</h2>
            <p>
              Stryde is designed to assist with goal pursuit, situational awareness, and action execution. In using the Service:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="font-semibold text-[var(--ink)]">Not Professional Advice:</strong> Suggestions, roadmaps,
                and summaries produced by the AI kernel are tentative hypotheses and strategic aids. Stryde does not provide licensed
                medical, clinical, legal, accounting, tax, or investment advice. You remain solely responsible for validating real-world
                decisions and outcomes.
              </li>
              <li>
                <strong className="font-semibold text-[var(--ink)]">Factual Grounding:</strong> While Stryde checks claims against
                empirical sources and provides citation links, external web pages may change or contain inaccuracies. Always review
                source references directly before relying on critical data.
              </li>
              <li>
                <strong className="font-semibold text-[var(--ink)]">No Autonomous Financial Commitments:</strong> Stryde cannot and
                will not execute financial commitments, legally binding contracts, or irreversible external actions on your behalf
                without your explicit manual confirmation.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">3. Billing, Plans, and Cancellations</h2>
            <p>
              Payments and subscriptions are processed by our Merchant of Record, Paddle.com Inc., which handles all billing inquiries
              and tax obligations.
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="font-semibold text-[var(--ink)]">Subscription Renewal:</strong> Paid plans renew automatically at
                the stated billing interval (monthly or annual) unless cancelled prior to the renewal date.
              </li>
              <li>
                <strong className="font-semibold text-[var(--ink)]">Easy Cancellation:</strong> You may cancel your subscription at
                any time via your account settings. Upon cancellation, your access remains active until the end of your current prepaid period.
              </li>
              <li>
                <strong className="font-semibold text-[var(--ink)]">Refunds:</strong> Refunds are handled according to Paddle&apos;s standard
                customer protection policies and applicable consumer laws.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">4. Acceptable Use Policy</h2>
            <p>You agree not to misuse the Service. Specifically, you may not:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Engage in prompt injection, jailbreaking, or adversarial attempts to extract system prompts or bypass security filters.</li>
              <li>Attempt to access other users&apos; accounts, private pursuits, or bypass row-level tenant security barriers.</li>
              <li>Use automated tools to launch denial-of-service attacks, scrape the platform, or cause runaway compute costs.</li>
              <li>Use the Service to generate defamatory, harassing, sexually explicit, or unlawful content.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">5. Account Termination & Right to Delete</h2>
            <p>
              You may terminate your account at any time. Under Apple App Store Guideline 5.1.1(v) and privacy regulations,
              deleting your account will immediately and permanently erase all your pursuits, conversations, memories, and personal
              records from Stryde&apos;s database.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">6. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, Stryde and its operators shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages, or any loss of profits, data, or goodwill resulting from your
              use of or inability to use the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">7. Contact Information</h2>
            <p>
              For legal inquiries or questions regarding these Terms, contact us at{" "}
              <a href="mailto:legal@stryde.dev" className="text-[var(--ink)] underline hover:text-[var(--signal)]">
                legal@stryde.dev
              </a>.
            </p>
          </section>
        </article>

        <footer className="mt-16 border-t border-[var(--rule)] pt-6 text-[12px] text-[var(--ink-muted)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p>© {new Date().getFullYear()} Stryde. All rights reserved.</p>
            <div className="space-x-4">
              <Link href="/terms" className="font-semibold text-[var(--ink)]">
                Terms of Service
              </Link>
              <Link href="/privacy" className="hover:text-[var(--ink)]">
                Privacy Policy
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
