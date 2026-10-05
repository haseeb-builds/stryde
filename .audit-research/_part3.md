---

## 4. The 3 most relevant apps — underlying libraries / frameworks

Each subsection: (a) what the **root README** states, quoted; (b) what the **app's own README** states,
quoted; (c) the **verbatim `requirements.txt` / `package.json`**; (d) **imports actually observed** in the
source files, as an independent check. Where the READMEs say nothing, it is marked UNKNOWN.

### 4a. `rag_tutorials/multimodal_agentic_rag/` — Multimodal Agentic RAG

**Root README entry (quoted verbatim):**
```
*   [🧬 Multimodal Agentic RAG](rag_tutorials/multimodal_agentic_rag/) - Text, PDFs, images, audio, and video, answered with citations
```

The root README names **no** library or framework for this app. That info is in the app's own README.

**App README, quoted:**

> This is a multimodal RAG app built with **Gemini Embedding 2** and **Google ADK**. Add text, URLs, PDFs,
> images, audio, or video; ask a question; and get a grounded answer with clear citations.

Its own `## Architecture` table, quoted verbatim:

| Layer | Role |
|---|---|
| React + Vite frontend | Source manager, Q&A panel, citations, trace, and 3D embedding view |
| FastAPI backend | Ingestion, retrieval, answer API, and embedding-space snapshots |
| `MultimodalRagStore` | In-memory source metadata, chunks, embeddings, search, and PCA projection |
| Gemini Embedding 2 | Source and query embeddings across supported modalities |
| Google ADK agent | Answer coordinator that receives the same retrieval packet shown in the UI |

Quoted bullets from `## What It Does`:

- "Uses Gemini Embedding 2 for source and query embeddings."
- "Requires `GOOGLE_API_KEY`; the app does not use local vector or answer fallbacks."
- "Retrieves evidence with cosine similarity over the stored embeddings."
- "Runs a Google ADK agent to coordinate answer generation from the retrieved context."
- "Projects source and query vectors into a 3D PCA view for inspection."

**`backend/requirements.txt`, verbatim:**
```
fastapi>=0.115.0
uvicorn>=0.30.0
google-genai>=1.0.0
google-adk>=1.0.0
python-multipart>=0.0.7
beautifulsoup4>=4.12.0
httpx>=0.27.0
```

**`frontend/package.json` dependencies, verbatim:** `react ^19.2.3`, `react-dom ^19.2.3`, `three ^0.181.2`,
`vite ^7.2.7`, `@vitejs/plugin-react ^5.1.1`, `lucide-react ^0.561.0`; devDeps `typescript ^5.9.3`,
`@types/three ^0.181.0`, `@types/react ^19.2.7`, `@types/react-dom ^19.2.3`, `@types/node ^24.10.3`.

**Observed imports (independent verification):** `server.py` → `fastapi`, `google.adk.runners`,
`google.adk.sessions`, `google.genai`, `bs4`, `httpx`, `pydantic`, `uvicorn`, `starlette.concurrency`;
`rag_store.py` → `google.genai` (no vector DB library — consistent with the README's "in-memory index");
`agentic_rag_agent/agent.py` → `google.adk.agents`, `google.genai`.

**Audit-relevant limits, quoted:** "Storage is in memory. Restarting the backend resets the demo index."
"URL ingestion blocks localhost and private IP ranges unless `ALLOW_PRIVATE_URLS=true` is set."
"Media files uploaded through the Gemini File API are cleaned up after embedding." And its own production
caveat: "For production, replace the in-memory store with durable storage and add authentication, background
ingestion, evals, observability, and a managed vector database."  **There is no vector database and no
persistence layer in this app.** Backend `:8897`, frontend `:5177`.

**Directory file listing (scraped):** `['README.md']` at the app root — code lives in `backend/` and
`frontend/` subdirectories (per the app README's `## Project Structure` block, quoted above). Note the
app root has **no `requirements.txt`**; it is at `backend/requirements.txt`.

### 4b. `rag_tutorials/knowledge_graph_rag_citations/` — Knowledge Graph RAG with Citations

**Root README entry (quoted verbatim):**
```
*   [🕸️ Knowledge Graph RAG with Citations](rag_tutorials/knowledge_graph_rag_citations/) - Multi-hop answers with verifiable source attribution
```

Root README names **no** framework. The app README does.

**App README, quoted:**

> A **Streamlit** application demonstrating how **Knowledge Graph-based Retrieval-Augmented Generation (RAG)**
> provides multi-hop reasoning with fully verifiable source attribution.

Its feature table, quoted verbatim:

| Feature | Description |
|---|---|
| 🔗 **Multi-hop Reasoning** | Traverse entity relationships to answer complex questions |
| 📚 **Verifiable Citations** | Every claim includes source document and text |
| 🧠 **Reasoning Trace** | See exactly how the answer was derived |
| 🏠 **Fully Local** | Uses Ollama for LLM, Neo4j for graph storage |

Quoted key components: "**`KnowledgeGraphManager`**: Neo4j interface for graph operations",
"**`extract_entities_with_llm()`**: LLM-based entity/relationship extraction",
"**`generate_answer_with_citations()`**: Multi-hop RAG with provenance tracking".

**`requirements.txt`, verbatim (complete — only 3 deps):**
```
streamlit>=1.28.0
ollama>=0.1.0
neo4j>=5.0.0
```

**Observed imports:** `knowledge_graph_rag.py` (20,125 bytes) → `streamlit`, `neo4j`, `ollama`, plus stdlib
(`dataclasses`, `hashlib`, `json`, `re`, `os`, `typing`) and a third-party `multiple`. Confirms the README.

**Directory file listing (scraped, verbatim):** `['Dockerfile', 'README.md', 'docker-compose.yml',
'knowledge_graph_rag.py', 'requirements.txt']` — i.e. it ships Neo4j container orchestration, which the README
documents as `docker run -d --name neo4j -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/password neo4j:latest`.
Defaults quoted from its config table: Neo4j URI `bolt://localhost:7687`, user `neo4j`, LLM model `llama3.2`.

**Two audit caveats:**
1. **License conflict.** The app README's `## 📝 License` section says `MIT License`; the repo root is
   Apache-2.0 and this directory has **no** LICENSE file. **Effective license: UNKNOWN.**
2. **Attribution.** Quoted: "This example is inspired by [VeritasGraph](https://github.com/bibinprathap/VeritasGraph),
   an enterprise-grade framework for: On-premise knowledge graph RAG, Visual reasoning traces (Veritas-Scope),
   LoRA-tuned LLM integration". VeritasGraph's own license is **UNKNOWN** (not fetched). If the derivation is
   substantial, that is a second license question to resolve.

### 4c. `mcp_ai_agents/browser_mcp_agent/` — Browser MCP Agent

**Root README entry (quoted verbatim):**
```
*   [♾️ Browser MCP Agent](mcp_ai_agents/browser_mcp_agent/) - Drive a real browser with natural language over MCP
```

Root README names **no** framework. The app README does, and it is the most explicit of the three.

**App README, quoted:**

> A **Streamlit** application that allows you to browse and interact with websites using natural language
> commands through the **Model Context Protocol (MCP)** and **MCP-Agent** with **Playwright** integration.

Its `## Architecture` section, quoted verbatim in full:

The application uses:
- Streamlit for the user interface
- MCP (Model Context Protocol) to connect the LLM with tools
- Playwright for browser automation
- [MCP-Agent](https://github.com/lastmile-ai/mcp-agent/) for the Agentic Framework
- OpenAI's models to interpret commands and generate responses

**`requirements.txt`, verbatim (complete — only 3 deps):**
```
streamlit>=1.28.0
mcp-agent>=0.0.14
openai>=1.0.0
```

**Observed imports:** `main.py` (7,061 bytes) → `streamlit`, `mcp_agent.agents.agent`, `mcp_agent.app`,
`mcp_agent.workflows.llm.augmented_llm`, `mcp_agent.workflows.llm.augmented_llm_openai`, plus stdlib `asyncio`,
`os`, `textwrap`. **Note:** Playwright is **not** a Python dependency — the README requires Node.js/npm for it,
and states "This is a critical requirement! The app uses Playwright to control a headless browser".

**Directory file listing (scraped, verbatim):** `['README.md', 'main.py', 'mcp_agent.config.yaml',
'mcp_agent.secrets.yaml.example', 'requirements.txt']`.

**Local-model path, quoted:** "Because `mcp-agent` talks to an OpenAI-compatible endpoint and Ollama exposes
one at `http://localhost:11434/v1`, this agent runs against a local model with just config changes — no code
edits or extra dependencies." Quoted caveat: "browser automation benefits from a reasoning-capable model.
Smaller local models may struggle with multi-step Playwright tasks." Requirement: Python 3.8+ and an
OpenAI **or** Anthropic API key. **It cannot run fully offline without a local OpenAI-compatible endpoint.**

### Cross-app comparison

| | multimodal_agentic_rag | knowledge_graph_rag_citations | browser_mcp_agent |
|---|---|---|---|
| UI | React + Vite | Streamlit | Streamlit |
| Backend | FastAPI + uvicorn | in-process Streamlit script | in-process Streamlit script |
| Agent framework | Google ADK (`google-adk>=1.0.0`) | none (hand-rolled, direct `ollama` calls) | `mcp-agent>=0.0.14` |
| LLM provider | Gemini via `google-genai` | Ollama `llama3.2`, local | OpenAI or Anthropic; Ollama via OpenAI-compatible base_url |
| Retrieval store | **in-memory** + cosine sim, no vector DB | **Neo4j** graph | n/a (tool-use, no retrieval) |
| Root `requirements.txt`? | no — it's at `backend/` | yes (3 deps) | yes (3 deps) |
| Nested LICENSE? | no | no (README says MIT) | no |
| Persistence | none (resets on restart) | Neo4j via docker-compose | n/a |

---

## 5. Findings summary for the reuse audit

1. **License is permissive and reuse-friendly, but not uniform.** Root = unmodified **Apache-2.0**, no NOTICE,
   unfilled copyright placeholder. 5 nested **MIT** LICENSEs in `generative_ui_agents/` carry *different* named
   copyright holders (`Atai Barkai` ×4, `Tyler Slaton` ×1) → treat as third-party attributions. One app README
   (`knowledge_graph_rag_citations`) self-declares **MIT** against a root Apache-2.0 with no LICENSE file —
   **ambiguous, needs clarification.**
2. **README is not a complete index.** Verified: `rag_tutorials` 24 on disk / 21 listed; `single_agent_apps`
   18 / 14 listed; `multi_agent_apps` 16+`agent_teams` / ~20 listed; `starter_ai_agents` 17 / 13;
   `advanced_llm_apps` has 6 entirely unlisted subprojects. A discovery sweep that trusts the README alone
   **misses real code**.
3. **"Hand-built, tested end-to-end" is marketing.** The only two workflows are `.github/workflows/claude.yml`
   and `.github/workflows/skill-evals.yml`, and the latter is `paths:`-scoped to `agent_skills/**` and
   `README.md`. **No CI covers any of the 97 `requirements.txt` apps.** Verify each app by running it.
4. **The three audit-relevant apps are genuinely small and well-scoped.** kg_rag = 1 file / 3 deps / Docker;
   browser_mcp = 1 `main.py` / 3 deps; mm_rag = a FastAPI backend + a React/Vite frontend, but **no vector DB
   and no persistence** (its own README says to "replace the in-memory store with durable storage" for
   production). Low integration surface; the depth is in the prompt/agent wiring, not the plumbing.
5. **Two distinct RAG strategies are represented.** mm_rag = dense multimodal embeddings + cosine similarity +
   an ADK agent as answer coordinator, with a deliberate single-retrieval design: "`/ask` performs retrieval
   once and passes that same retrieval packet into the ADK answer flow. The answer and the citation panel are
   therefore based on the same ranked evidence." kg_rag = LLM entity/relation extraction into Neo4j + multi-hop
   traversal + provenance tracking, fully local via Ollama.
6. **`self-improving-agent-skills` is registry-inconsistent.** It is the repo's featured gallery tile and a
   README entry, but it is **absent from `agent_skills/registry.json`** (7 of 8 skills registered) and its
   declared license is therefore **UNKNOWN**. Also, `registry.json`'s `first-reader` entry has an **empty**
   license field and a **null** author.
7. **Ingest-SSRF guard already present in mm_rag.** "URL ingestion blocks localhost and private IP ranges
   unless `ALLOW_PRIVATE_URLS=true` is set" — a deliberate SSRF control. Note the env var is an opt-out.
8. **The collection is commercially adjacent.** The README carries sponsor banners (TinyFish, "Become a
   Sponsor" → `sponsorunwindai.com`) and funnels to `theunwindai.com` ("New templates drop weekly", "Clone it,
   ship it, sell it"). Apache-2.0 permits commercial redistribution, but per **§6 the trademark grant does not
   extend** to those names/logos. Also note `ripple/` and `needle/` are **Google Doc / Chrome-extension**
   integrations, which carry their own Google API terms independent of this license.
9. **A README typo is faithfully present:** both `needle/` and `ripple/` descriptions end with the truncated
   string `TypeSafe Jev` (verified byte-level in the raw file, not a scraping artifact). The library name is
   therefore **UNKNOWN** from the README alone.
10. **Repo is actively maintained but README-churn heavy.** HEAD `2026-09-29T04:56:53Z`; the last 20 commits
    are dominated by README/sponsor/docs edits. Star/fork counts are **UNKNOWN** (GitHub API 403).

## 6. Explicit UNKNOWNs

- Star count, fork count, watcher count, GitHub license classification, `created_at`, `pushed_at` — API 403.
- The library behind the string `TypeSafe Jev` (README typo/truncation, unresolvable from the README).
- The effective license of `rag_tutorials/knowledge_graph_rag_citations` (README MIT vs. root Apache-2.0).
- The declared license of `agent_skills/self-improving-agent-skills` (absent from `registry.json`).
- The license of the upstream `VeritasGraph` project that `knowledge_graph_rag_citations` is "inspired by".
- Whether any of the 97 `requirements.txt` apps actually run — **no CI executes them**; not tested in this audit.
- Versions/pins for the 9 `package.json` projects beyond what their own manifests declare (only the mm_rag
  frontend manifest was fetched, since it is one of the 3 audit-relevant apps).

---

## Appendix: local evidence files written by this audit

Written to `.audit-research/` alongside this report:

- `_raw_LICENSE.txt`
- `_raw_README.md`
- `_raw_mm_rag_readme.txt`
- `_raw_kg_rag_readme.txt`
- `_raw_browser_mcp_readme.txt`
- `_raw_kg_rag_req.txt`
- `_raw_browser_mcp_req.txt`
- `_toplevel_clean.json`
- `_raw_sections.json`
- `_raw_dir_files.json`
- `_parsed_links.txt`
- `_raw_agent_skills_registry.json`
- `_raw_agent_skills_.github_workflows_skill-evals.yml`
- `_part1.md`
- `_part2.md`
- `_part3.md`