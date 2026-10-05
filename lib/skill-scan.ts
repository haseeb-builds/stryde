// Security scanning for Stryde Skills (Issue #6 decision 3). A skill is
// procedural memory that future turns will follow — which makes it an
// injection and exfiltration vector if it is written carelessly or
// maliciously. Every proposed or revised skill passes this scan before it can
// become ACTIVE; the scan is a pure function so tests can pin every rule.

export type ScanSeverity = "BLOCKED" | "FLAGGED";

export type ScanFinding = {
  rule: string;
  severity: ScanSeverity;
  excerpt: string;
  why: string;
};

export type SkillScanResult = {
  verdict: "PASS" | "FLAGGED" | "BLOCKED";
  findings: ScanFinding[];
};

type Rule = {
  name: string;
  pattern: RegExp;
  severity: ScanSeverity;
  why: string;
};

// Text is lowercased for matching; keep patterns lowercase.
const RULES: Rule[] = [
  {
    name: "prompt_injection_override",
    pattern: /(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions|prompts|rules)/i,
    severity: "BLOCKED",
    why: "A procedure that instructs the model to abandon its operating rules is a prompt-injection payload.",
  },
  {
    name: "prompt_injection_system",
    pattern: /(system\s*prompt|you\s+are\s+now|new\s+instructions?:)\s/i,
    severity: "BLOCKED",
    why: "A procedure that attempts to redefine the assistant's identity or instructions.",
  },
  {
    name: "credential_reference",
    pattern: /(api[_-]?key|secret|password|bearer\s+[a-z0-9._-]{10,}|sk-[a-z0-9]{8,}|env\s*:\s*[A-Z_]+)\b/i,
    severity: "BLOCKED",
    why: "A procedure must never reference or move credentials; skills cannot silently gain permissions.",
  },
  {
    name: "credential_http_egress",
    pattern: /(fetch|axios|curl|wget|invoke-webrequest|iwr)[^\n]{0,80}(authorization|token|key|secret)/i,
    severity: "BLOCKED",
    why: "A procedure that sends credentials to an endpoint is an exfiltration channel.",
  },
  {
    name: "destructive_command",
    pattern: /(rm\s+-rf|del\s+\/[fsq]|rd\s+\/s|format\s+[a-z]:|mkfs|drop\s+database|truncate\s+table)/i,
    severity: "BLOCKED",
    why: "Destructive operations are outside what a procedural skill may contain.",
  },
  {
    name: "pipe_to_shell",
    pattern: /(curl|wget|iwr|invoke-webrequest)[^\n|]*\|\s*(sh|bash|zsh|powershell|iex|invoke-expression)/i,
    severity: "BLOCKED",
    why: "Remote-code-execution patterns are never procedural steps.",
  },
  {
    name: "privilege_escalation",
    pattern: /\b(sudo|runas|start-process\s+-verb\s+runas|chmod\s+777)\b/i,
    severity: "FLAGGED",
    why: "Privilege changes need human review before this skill can become active.",
  },
  {
    name: "hidden_directive",
    pattern: /(<system>|<\|im_start\|>|<\/s>|do\s+not\s+tell\s+the\s+user|hide\s+this\s+from)/i,
    severity: "BLOCKED",
    why: "Hidden-directive markers suggest the skill is trying to act covertly.",
  },
  {
    name: "authority_grab",
    pattern: /(grant\s+(itself|yourself|yourself)|bypass\s+(the\s+)?(approval|permission|authority)|without\s+(user\s+)?(approval|consent))/i,
    severity: "BLOCKED",
    why: "A skill can never grant authority or bypass Stryde's permission model.",
  },
];

export function scanSkillText(text: string): SkillScanResult {
  const findings: ScanFinding[] = [];
  for (const rule of RULES) {
    const match = text.match(rule.pattern);
    if (match) {
      findings.push({
        rule: rule.name,
        severity: rule.severity,
        excerpt: match[0].slice(0, 120),
        why: rule.why,
      });
    }
  }
  if (findings.some((f) => f.severity === "BLOCKED")) return { verdict: "BLOCKED", findings };
  if (findings.length > 0) return { verdict: "FLAGGED", findings };
  return { verdict: "PASS", findings: [] };
}

// Lifecycle policy (decision C): a clean scan may become ACTIVE automatically;
// a flagged skill requires explicit approval; a blocked skill is refused
// outright. The approval gate is therefore policy, not a questionnaire.
export function skillRequiresApproval(scan: SkillScanResult): boolean {
  return scan.verdict === "FLAGGED";
}

export function skillIsRefused(scan: SkillScanResult): boolean {
  return scan.verdict === "BLOCKED";
}
