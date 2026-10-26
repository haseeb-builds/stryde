import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Stryde",
  description: "Privacy policy, generative AI data processing disclosures, and subprocessor list for Stryde.",
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
            Last updated: October 26, 2026 · Effective immediately
          </p>
        </header>

        <article className="space-y-8 text-[14.5px] leading-relaxed text-[var(--ink-secondary)]">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">1. Overview & Data Ownership</h2>
            <p>
              Stryde is a situational-intelligence platform built on a core principle:{" "}
              <strong className="font-semibold text-[var(--ink)]">your pursuits, observations, decisions, and data belong to you</strong>.
              We do not sell your personal data, nor do we license your goals, conversation logs, or private notes to data brokers.
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
                pursuit contexts, and working state are processed solely to deliver real-time analysis to your session. They are not
                used to train foundation models or public generative systems.
              </li>
              <li>
                <strong className="font-semibold text-[var(--ink)]">Context Minimization:</strong> Our Context Compiler delivers only
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
                    <td className="p-3">Stateless PostgreSQL database, secure auth, row-level isolation</td>
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
                    <td className="p-3 font-medium text-[var(--ink)]">Paddle.com Inc.</td>
                    <td className="p-3">Merchant of record, PCI-compliant billing and subscription management</td>
                    <td className="p-3 font-mono text-[11.5px]">United Kingdom / Global</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">4. Right to Erasure & Account Deletion (Apple Guideline 5.1.1(v))</h2>
            <p>
              In full compliance with Apple App Store Review Guideline 5.1.1(v) and GDPR/CCPA regulations, you have the absolute right
              to delete your account and all associated personal data permanently.
            </p>
            <p>
              When you initiate an account deletion via your settings or our automated endpoint (<code>DELETE /api/v1/user/account</code>),
              all your pursuits, conversation messages, working states, claims, observations, memories, and uploaded sources are
              permanently purged from our database. Active billing subscriptions are flagged for immediate termination.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">5. Security & Perimeter Defense</h2>
            <p>
              We enforce multi-tenant Row-Level Security (RLS) across all database tables, protect server endpoints against Server-Side
              Request Forgery (SSRF) with strict IP and redirect checks, wrap user content in delimiter guards to prevent prompt injection,
              and enforce cryptographic webhook signature validation.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[var(--ink)]">6. Contact Us</h2>
            <p>
              If you have any questions or data privacy requests, contact us at{" "}
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
