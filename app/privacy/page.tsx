import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Stryde",
  description: "Privacy policy, generative AI data processing disclosures, statutory retention, and subprocessor list for Stryde.",
};

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>
          <p className="mt-2 text-[14px] text-[var(--ink-muted)]">
            Last updated: October 30, 2026 · Effective immediately
          </p>
        </header>

        <article className="space-y-8 text-[14.5px] leading-relaxed text-[var(--ink-secondary)]">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">1. Overview & Data Ownership</h2>
            <p>
              Stryde is a situational-intelligence platform built on a core principle:{" "}
              <strong className="font-semibold text-[var(--ink)]">your pursuits, observations, decisions, and data belong to you</strong>.
              We do not sell your personal data, nor do we license your goals, conversation logs, or private notes to third-party data brokers or marketing networks.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">2. Generative AI Data Processing</h2>
            <p>
              Stryde utilizes artificial intelligence and large language models (LLMs) to synthesize your situation,
              identify real-world bottlenecks, verify factual evidence, and propose adaptive next actions.
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="font-semibold text-[var(--ink)]">Zero Public Model Training:</strong> Your private prompts,
                pursuit contexts, and working state are processed solely to deliver real-time analysis to your session. Under commercial enterprise API agreements with our model providers (including Google Gemini API and OpenRouter), inputs and outputs are never used to train foundation models or public generative systems.
              </li>
              <li>
                <strong className="font-semibold text-[var(--ink)]">Transient In-Memory Processing:</strong> AI reasoning requests are processed transiently in memory for inference. Upstream model providers do not retain conversational payloads beyond ephemeral diagnostic logging windows permitted by enterprise terms.
              </li>
              <li>
                <strong className="font-semibold text-[var(--ink)]">Context Minimization:</strong> Our prompt compiler delivers only
                the specific subset of memories, skills, and observations required for each turn, never replaying your full canonical
                history indiscriminately.
              </li>
              <li>
                <strong className="font-semibold text-[var(--ink)]">Tentative Model Inferences:</strong> AI-generated advice and
                working state hypotheses are explicitly marked as model proposals and are never treated as verified ground truth until backed
                by empirical evidence.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">3. Authorized Subprocessors</h2>
            <p>
              To provide reliable, high-performance infrastructure, Stryde engages the following trusted third-party service providers
              under strict confidentiality and data protection agreements:
            </p>
            <div className="overflow-x-auto rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] p-1">
              <table className="w-full text-left text-[13px]">
                <thead className="border-b border-[var(--rule)] bg-[var(--surface-subtle)] font-semibold text-[var(--ink)]">
                  <tr>
                    <th className="p-3">Subprocessor</th>
                    <th className="p-3">Role / Service</th>
                    <th className="p-3">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--rule)] text-[var(--ink-secondary)]">
                  <tr>
                    <td className="p-3 font-medium text-[var(--ink)]">Google Cloud / Google AI</td>
                    <td className="p-3">Model inference and situational reasoning (Gemini API)</td>
                    <td className="p-3 font-mono text-[11.5px]">United States / Global</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium text-[var(--ink)]">OpenRouter</td>
                    <td className="p-3">Redundant model routing and failover inference</td>
                    <td className="p-3 font-mono text-[11.5px]">United States</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium text-[var(--ink)]">Supabase, Inc.</td>
                    <td className="p-3">PostgreSQL database, secure auth, row-level isolation</td>
                    <td className="p-3 font-mono text-[11.5px]">United States (AWS)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium text-[var(--ink)]">Vercel Inc.</td>
                    <td className="p-3">Application hosting, edge network routing, serverless compute</td>
                    <td className="p-3 font-mono text-[11.5px]">Global Edge Network</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium text-[var(--ink)]">Firecrawl / Mendable</td>
                    <td className="p-3">Factual webpage extraction and source observation</td>
                    <td className="p-3 font-mono text-[11.5px]">United States</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium text-[var(--ink)]">Exa Labs</td>
                    <td className="p-3">Semantic web search and source discovery</td>
                    <td className="p-3 font-mono text-[11.5px]">United States</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium text-[var(--ink)]">Paddle.com Inc.</td>
                    <td className="p-3">Merchant of record, PCI-compliant billing and subscription management</td>
                    <td className="p-3 font-mono text-[11.5px]">United Kingdom / Global</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">4. Cookies & Local Storage Technologies</h2>
            <p>
              Stryde uses strictly essential client-side storage technologies necessary to operate the platform and maintain authenticated sessions:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="font-semibold text-[var(--ink)]">Essential Authentication Tokens:</strong> We utilize secure local storage and essential session tokens (prefixed with <code>sb-*-auth-token</code>) provided by Supabase Auth to maintain encrypted cryptographic sessions between page navigations.
              </li>
              <li>
                <strong className="font-semibold text-[var(--ink)]">No Advertising or Cross-Site Trackers:</strong> Stryde does not deploy third-party advertising cookies, cross-site behavioral tracking beacons, or invasive marketing fingerprinting scripts.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">5. Right to Erasure & Account Deletion (Apple Guideline 5.1.1(v) & GDPR Art. 17)</h2>
            <p>
              In full compliance with Apple App Store Review Guideline 5.1.1(v) and global privacy regulations (GDPR/CCPA/CPRA), you have
              the absolute right to permanently delete your account and all associated personal data at any time.
            </p>
            <p>
              When you initiate an account deletion via your settings or our automated endpoint (<code>DELETE /api/v1/user/account</code>):
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Any active Paddle subscription is cancelled first to prevent future charges.</li>
              <li>An atomic deletion write barrier is established to prevent concurrent writes during cleanup.</li>
              <li>All user-associated database records across all 40 verified user-scoped tables (pursuits, conversation messages, working states, claims, observations, memories, and source adaptations) are purged in strict topological leaf-to-root order.</li>
              <li>Your authentication identity is removed from the identity provider only after complete data purge verification succeeds.</li>
              <li>The process is fail-closed: if any database deletion step fails, identity credentials remain intact to allow retry or recovery.</li>
            </ul>
            <div className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface-subtle)] p-4 text-[13.5px]">
              <strong className="font-semibold text-[var(--ink)]">Statutory Financial Retention Exception:</strong>
              <p className="mt-1">
                While all personal data, conversations, and pursuit records are permanently erased from Stryde, billing invoices and payment transactions processed through Paddle.com (acting as Merchant of Record) are legally retained by Paddle for a mandatory statutory period of 7 years in compliance with UK HMRC, EU VAT, and international tax and anti-money laundering regulations. These records are held exclusively for statutory accounting and tax compliance.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">6. Data Subject Rights (DSAR) & Data Portability</h2>
            <p>
              Under applicable data protection laws (including GDPR Articles 15 through 21 and the California Consumer Privacy Act), you possess the following rights regarding your personal data:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li><strong className="font-semibold text-[var(--ink)]">Right to Access (Art. 15):</strong> Request confirmation of whether your data is processed and receive a copy of your personal data.</li>
              <li><strong className="font-semibold text-[var(--ink)]">Right to Portability (Art. 20):</strong> Receive your pursuit history, memories, and observations in a structured, commonly used, machine-readable format (JSON export).</li>
              <li><strong className="font-semibold text-[var(--ink)]">Right to Rectification (Art. 16):</strong> Correct inaccurate or incomplete personal records directly through the application.</li>
              <li><strong className="font-semibold text-[var(--ink)]">Right to Erasure (Art. 17):</strong> Permanently purge all your data via the self-serve in-app deletion mechanism or by written request.</li>
            </ul>
            <p>
              To exercise your statutory data subject access rights or request a machine-readable data export, send an email to{" "}
              <a href="mailto:privacy@stryde.dev" className="text-[var(--ink)] underline hover:text-[var(--signal)]">
                privacy@stryde.dev
              </a>{" "}
              with the subject line &quot;Data Subject Request&quot; from your registered Stryde email address. We respond to all verified requests within the statutory 30-day timeline.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">7. Protection of Minors (COPPA & GDPR Art. 8)</h2>
            <p>
              Stryde is designed exclusively for adults and working professionals. The platform is not directed to, marketed toward, or intended for use by children under the age of 13 in the United States, or under the age of 16 in the European Economic Area (EEA) and United Kingdom.
            </p>
            <p>
              We do not knowingly collect or solicit personal data from children under these statutory ages. If we discover that an individual under the required age has registered an account, we will immediately lock the account and permanently delete all associated personal data in accordance with our deletion protocol. Parents or guardians who believe a minor has registered may contact{" "}
              <a href="mailto:privacy@stryde.dev" className="text-[var(--ink)] underline hover:text-[var(--signal)]">
                privacy@stryde.dev
              </a>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">8. Security & Perimeter Defense</h2>
            <p>
              We enforce multi-tenant Row-Level Security (RLS) across all database tables, protect server endpoints against Server-Side
              Request Forgery (SSRF) with strict scheme, IPv4/IPv6 private block, and loopback address checks, wrap untrusted context in boundary delimiters to prevent prompt injection,
              and enforce cryptographic webhook signature validation.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">9. Contact Us</h2>
            <p>
              If you have any questions, concerns, or data privacy requests, contact our privacy engineering team at{" "}
              <a href="mailto:privacy@stryde.dev" className="text-[var(--ink)] underline hover:text-[var(--signal)]">
                privacy@stryde.dev
              </a>.
            </p>
          </section>
        </article>

        <footer className="mt-16 border-t border-[var(--rule)] pt-6 text-[12px] text-[var(--ink-muted)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p>© {new Date().getFullYear()} Stryde. All rights reserved.</p>
            <div className="space-x-4">
              <Link href="/terms" className="hover:text-[var(--ink)]">
                Terms of Service
              </Link>
              <Link href="/privacy" className="font-semibold text-[var(--ink)]">
                Privacy Policy
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
