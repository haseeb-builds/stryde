# Stryde Engineering Governance

This rule governs all engineering operations across Stryde repositories, worktrees, agents, and subagents.

## Core Rules

1. **Never destroy uncommitted work**: Always inspect `git status` and working-tree modifications first. Never use `git reset --hard`, `git clean -fd`, or destructive checkouts without creating a recoverable snapshot or branch backup.
2. **Investigate before editing**: Trace root causes, contracts, and call paths across actual repository files. Distinguish fact, inference, hypothesis, and unknown.
3. **Test bug fixes and meaningful behavior changes**: Write or run focused unit/integration tests (`node --experimental-strip-types --test ...`) before and after changes.
4. **Use actual repository tooling**: Run repository scripts, npm test, tsc typecheck, eslint, and next build. Never claim checks passed without executing them.
5. **Preserve data ownership and security boundaries**: Maintain multi-tenancy, Row-Level Security (RLS), actor attribution (`auth.uid()`), trusted service role boundaries, SSRF validation, and input sanitization.
6. **Verify browser-facing changes**: Test rendered DOM, layout, interactive states, responsive viewports (1440x900 desktop, 390x844 mobile), focus traps, and console logs.
7. **Never invent evidence**: Do not fabricate citations, test runs, tool capability, provider readiness, or user outcomes.
8. **Continue autonomously until a real blocker**: Drive through the complete engineering loop without halting for routine approvals.
9. **Protect secrets and production data**: Never log, commit, or print API keys, tokens, or sensitive credentials. Never run destructive tests against production databases.
10. **Prioritize shipping over speculative scope**: Complete, verify, and harden the intended product rather than expanding into speculative side features.
