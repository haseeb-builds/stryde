import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Stryde",
  description: "Terms of service, generative AI usage terms, liability limitations, and billing policies for Stryde.",
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
            Last updated: October 30, 2026 · Effective immediately
          </p>
        </header>

        <article className="space-y-8 text-[14.5px] leading-relaxed text-[var(--ink-secondary)]">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">1. Acceptance of Terms & Eligibility</h2>
            <p>
              By accessing, browsing, or using Stryde (&quot;the Service&quot;), you agree to be bound by these Terms of Service
              and our Privacy Policy. If you do not agree to these terms, you must not access or use the Service.
            </p>
            <p>
              <strong className="font-semibold text-[var(--ink)]">Minimum Age Requirement:</strong> You represent and warrant that you are at least 13 years old (or at least 16 years old if you reside in the European Economic Area or United Kingdom), or the age of legal majority in your jurisdiction. The Service is not intended for or directed to individuals under these ages.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">2. Generative AI Capabilities & Disclaimers</h2>
            <p>
              Stryde is designed to assist with goal pursuit, situational awareness, and action execution through generative AI models and factual observation. In using the Service:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="font-semibold text-[var(--ink)]">Strictly Not Professional Advice:</strong> Suggestions, roadmaps,
                risk assessments, and summaries produced by the AI kernel are tentative hypotheses and strategic planning aids. Stryde does NOT provide licensed medical, clinical, mental health, legal, accounting, tax, or investment advice. You remain solely and independently responsible for evaluating, verifying, and deciding upon any real-world actions, contracts, healthcare decisions, or financial steps.
              </li>
              <li>
                <strong className="font-semibold text-[var(--ink)]">Factual Grounding & Citations:</strong> While Stryde checks claims against
                empirical sources and provides citation links, external web pages and third-party data may change, expire, or contain inaccuracies. Always review source references directly before relying on critical data.
              </li>
              <li>
                <strong className="font-semibold text-[var(--ink)]">No Autonomous Financial Commitments:</strong> Stryde cannot and
                will not execute financial transactions, enter into contracts, or trigger irreversible real-world actions on your behalf without your explicit manual review and confirmation.
              </li>
              <li>
                <strong className="font-semibold text-[var(--ink)]">No Guarantee of Outcome:</strong> Stryde provides organizational and situational tools to support goal execution. We do not guarantee specific career, educational, economic, or life outcomes from the use of the Service.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">3. Billing, Plans, and Cancellations</h2>
            <p>
              Payments, billing inquiries, and subscription lifecycle management are handled by our Merchant of Record, Paddle.com Inc., which handles sales tax, VAT, and customer billing compliance globally.
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="font-semibold text-[var(--ink)]">Subscription Renewal:</strong> Paid plans renew automatically at
                the stated billing interval (monthly or annual) unless cancelled prior to the renewal date.
              </li>
              <li>
                <strong className="font-semibold text-[var(--ink)]">Easy Self-Serve Cancellation:</strong> You may cancel your subscription at
                any time via your account settings. Upon cancellation, your access remains active until the end of your current prepaid billing cycle without further charges.
              </li>
              <li>
                <strong className="font-semibold text-[var(--ink)]">Refunds:</strong> Refunds are administered according to Paddle&apos;s standard
                buyer protection policies and statutory consumer rights applicable in your jurisdiction.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">4. Acceptable Use Policy</h2>
            <p>You agree not to misuse the Service. Specifically, you agree that you will not:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Engage in prompt injection, adversarial jailbreaking, or attempts to extract confidential system instructions or underlying agent architecture.</li>
              <li>Attempt to access other users&apos; accounts, private pursuits, or bypass multi-tenant row-level security barriers.</li>
              <li>Use automated scrapers, bots, or excessive concurrent requests to launch denial-of-service attacks, bypass rate limits, or cause abnormal compute exhaustion.</li>
              <li>Use the Service to generate defamatory, harassing, sexually explicit, abusive, or unlawful content, or to plan physical harm or criminal acts.</li>
              <li>Probe, scan, or test the vulnerability of any system, network, or endpoint without prior written authorization.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">5. Account Termination & Permanent Data Deletion</h2>
            <p>
              You may terminate your account at any time. In full compliance with Apple App Store Guideline 5.1.1(v) and international data privacy regulations, initiating account deletion will immediately lock concurrent writes and permanently erase all your pursuits, conversations, memories, working states, and personal records across all 40 verified database tables in topological order.
            </p>
            <p>
              We reserve the right to suspend or terminate accounts that violate our Acceptable Use Policy or present security risks to our platform or other users.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">6. Disclaimer of Warranties & Limitation of Liability</h2>
            <p>
              THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, OR NON-INFRINGEMENT.
            </p>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL STRYDE, ITS AFFILIATES, OFFICERS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, PUNITIVE, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES, INCLUDING WITHOUT LIMITATION DAMAGES FOR LOSS OF PROFITS, GOODWILL, USE, DATA, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATING TO THE USE OF, OR INABILITY TO USE, THE SERVICE.
            </p>
            <p>
              UNDER NO CIRCUMSTANCES SHALL STRYDE&apos;S TOTAL AGGREGATE LIABILITY ARISING OUT OF OR IN CONNECTION WITH THESE TERMS OR THE SERVICE EXCEED THE GREATER OF ONE HUNDRED UNITED STATES DOLLARS ($100.00 USD) OR THE TOTAL AMOUNT PAID BY YOU TO STRYDE IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">7. Governing Law & Dispute Resolution</h2>
            <p>
              <strong className="font-semibold text-[var(--ink)]">Informal Resolution First:</strong> Before filing a formal claim, you agree to contact us at{" "}
              <a href="mailto:legal@stryde.dev" className="text-[var(--ink)] underline hover:text-[var(--signal)]">
                legal@stryde.dev
              </a>{" "}
              and attempt in good faith to resolve any dispute informally for at least thirty (30) days.
            </p>
            <p>
              <strong className="font-semibold text-[var(--ink)]">Governing Law:</strong> These Terms and any dispute arising out of or related to them shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law principles.
            </p>
            <p>
              <strong className="font-semibold text-[var(--ink)]">Arbitration & Class Action Waiver:</strong> Any controversy or claim arising out of or relating to these Terms or the Service that cannot be resolved informally shall be resolved by binding, individual arbitration administered in accordance with the commercial arbitration rules of the American Arbitration Association (AAA), except that you or Stryde may assert claims in small claims court if eligible. You and Stryde agree that each may bring claims against the other only in an individual capacity and not as a plaintiff or class member in any purported class, collective, or representative proceeding.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">8. Contact Information</h2>
            <p>
              For legal inquiries or questions regarding these Terms, contact our legal team at{" "}
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
