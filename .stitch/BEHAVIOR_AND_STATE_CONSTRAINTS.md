# Stryde Behavior & State Constraints

## 1. Truth in Execution & Runner States
Stryde enforces strict distinction between actions assigned to a human versus actions queued for an automated background worker:
- **`owner_type === "HUMAN"`:** Labeled **"Your Next Step"**. Surfaces clear instructions and direct completion/blocker reporting controls.
- **`owner_type !== "HUMAN"` and `status === "queued"`:** Must NEVER imply that execution has begun. It is labeled **"Queued for background runner (not running yet)"**.
- **Manual Fallback Invariant:** If an automated worker is queued or blocked, the UI must ALWAYS provide manual override buttons (`Report done` / `Report blocker`) so the human operator is never trapped waiting for an unavailable worker daemon.

## 2. Epistemic Verification Model
Stryde maintains a strict epistemic hierarchy:
- **User-Reported Outcome (`reported`):** Treated as an unverified user assertion. Styled in neutral/ochre tones with explicit provenance: *"Reported by you"*.
- **Observation-Backed (`evidence linked`):** Linked to an actual execution log, terminal output, or retrieved artifact.
- **Verified Fact (`verified`):** Used ONLY when independent external evidence or explicit user confirmation verifies the outcome. Rendered with the forest-green (`#15603c`) badge and cited snippet.
- **Contradicted / Unverifiable:** Explicitly labeled to prevent confirmation bias.

## 3. Reassessment & Degraded States
- When adaptive background analysis fails or is rate-limited (`state_status === "stalled"`), Stryde refuses to hallucinate advice.
- Instead, the Operational Brief clearly announces: *"Adaptive reassessment is temporarily unavailable"* and offers a direct `Reassess` recovery button while preserving the user's manual action path.

## 4. No Ontology Leakage
- Backend database enums (`WAITING_USER`, `WAITING_EXTERNAL`, `CONTROLLED`, `HUMAN_ACTION_RESULT`, `CREATE_ACTION`) must NEVER appear as primary navigation, section titles, or button labels.
- All interface copy must use natural, human-grade language focused on the user's real situation.

## 5. Continuity & Preservation Invariant
- A user's uncommitted composer text must never be lost during background polling or route transitions.
- All generated deliverables (artifacts) must preserve prior version history (`v1..vN`) via immutable lineage records.
