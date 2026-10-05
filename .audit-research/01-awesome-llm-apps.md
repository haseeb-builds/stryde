# 01 — Factual Inventory: `Shubhamsaboo/awesome-llm-apps`

**Purpose:** the mandated discovery source for the Stryde reuse audit. Everything below is transcribed or
mechanically derived from live fetches. **No app names, paths, or libraries are invented.** Anything not
verifiable is written as UNKNOWN.

## Provenance / fetch method

| Artifact | Source URL | Result |
|---|---|---|
| README | `https://raw.githubusercontent.com/Shubhamsaboo/awesome-llm-apps/main/README.md` | HTTP 200, 25,534 bytes |
| LICENSE | `https://raw.githubusercontent.com/Shubhamsaboo/awesome-llm-apps/main/LICENSE` | HTTP 200, 11,357 bytes |
| Directory tree | `https://github.com/…/tree/main/<path>` (embedded JSON in HTML) | HTTP 200 per dir |
| Activity | `https://github.com/Shubhamsaboo/awesome-llm-apps/commits/HEAD.atom` | HTTP 200, 20 entries |

**API caveat:** `https://api.github.com/repos/Shubhamsaboo/awesome-llm-apps` returned **HTTP 403 (rate limit
exceeded)** on every attempt. All tree data therefore comes from scraping `github.com/OWNER/REPO/tree/main/…`
and parsing the `"name":…,"path":…,"contentType":…` JSON embedded in each page. Consequence: star count,
fork count, GitHub's own license classification, and `pushed_at` are **UNKNOWN** in this report.

**HEAD commit** (`commits/HEAD.atom`, `updated` = **2026-09-29T04:56:53Z**, sha
`4bf51ab704fb2c5b3803cd5191b30d7dcdb51dc2`) — title quoted from the feed:

> Restore agent run instructions and add template section

Recent history is almost entirely README/skill/docs churn and sponsor-banner edits, e.g.
`docs(readme): add TinyFish sponsor banner, drop top Unwind banner` (2026-09-29T01:53:16Z),
`fix(self-improving-agent-skills): replace dead gemini-3-pro-preview s…` (2026-09-26T08:22:14Z).
All authors in the last 20 commits: `Shubhamsaboo` or empty. **Only 2 CI workflows exist at**
`.github/workflows/`: `claude.yml`, `skill-evals.yml` — and `skill-evals.yml` only covers `agent_skills/**`
and `README.md`, so **there is no CI gate on any of the 97 Python apps**.

**Path verification:** all **119** local (non-external) paths linked from the README were HTTP-checked against
`github.com/…/tree/main/<path>`. **All 119 returned HTTP 200 — zero dead links.** The 2 external links
(`accomplish-ai/coworker`, `akshayaggarwal99/jarvis-ai-assistant`) live outside this repo and are out of scope.

---

## 1. License

**Exact type: Apache License, Version 2.0 (January 2004)** — verbatim standard text, unmodified.

First lines, quoted from the fetched LICENSE:

```
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION
```

It is the **bare, unmodified Apache-2.0 text**. The `APPENDIX: How to apply the Apache License to your work`
section still contains the unfilled template line `Copyright [yyyy] [name of copyright owner]` — no
copyright holder is filled in, and there is **no `NOTICE` file** at repo root (root files are exactly
`.gitattributes`, `.gitignore`, `LICENSE`, `README.md`).

README footer, quoted:

```
<sub>Apache-2.0 · See <a href="LICENSE">LICENSE</a> · Fork it, ship it, sell it.</sub>
```

README headline, quoted:

```
**100+ open-source AI agents, agent skills, and RAG apps. Hand-built, tested end-to-end, Apache-2.0.**

Clone it, ship it, sell it - 100% free and open-source
```

Note the tension: the README claims "Hand-built, **tested end-to-end**", but as noted above the only CI
workflow covers `agent_skills/**`. There is **no automated test suite evident at repo root** for the apps.

### Redistribution caveats (Apache-2.0)

These are the standard, unmodified Apache-2.0 obligations — they follow from the license text itself, not
from any repo-specific policy:

1. **§4 — NOTICE propagation.** "If the Work includes a NOTICE text file … You must include a readable copy
   of the attribution notices **from the NOTICE file**." No NOTICE file exists here, so this specific
   obligation is currently vacuous — but if one is added downstream it becomes binding.
2. **§4 — license copy.** A redistribution must carry a copy of the Apache-2.0 license and keep it intact.
3. **§4 — change marking.** Modified files must carry prominent notices stating that You changed the files.
4. **§4 — retain authorship.** Existing copyright/patent/attribution notices in the source must be retained.
5. **§6 Trademarks.** The grant does **not** include the right to use the contributors' names, logos, or
   trademarks. Removing the sponsor banners and the `theunwindai.com` / `trendshift.io` promotional links is
   not a trademark violation, but do not rebrand the collection as an official work.
6. **§7 warranty disclaimer + §8 liability.** "AS IS" / "AS AVAILABLE," no warranty of any kind; the
   contributors accept liability only for their own negligent acts. No indemnity clause runs against you.
7. **§2 patent grant.** Includes an express patent license from each contributor, terminable if you initiate
   patent litigation alleging the Work infringes.
8. **Third-party API keys are not covered.** "100% free and open-source" refers to the code only. Nearly every
   app calls a paid commercial LLM API (OpenAI, Gemini, Anthropic, xAI, DeepSeek, Cohere). Cost and API terms
   are the deployer's responsibility. Several also require third-party services (Firecrawl, Neo4j, Ollama,
   Airbnb, Google Maps).

### Per-directory license overrides — IMPORTANT for a reuse audit

The root Apache-2.0 license is **not** uniform across the tree. Nested `LICENSE` files exist and are **MIT**,
with **different named copyright holders** (third-party attributions):

| Directory | Nested LICENSE (first line, quoted) |
|---|---|
| `generative_ui_agents/generative-ui-starter-project/` | `The MIT License  Copyright (c) Atai Barkai` |
| `generative_ui_agents/ai-financial-coach-agent/` | `The MIT License  Copyright (c) Atai Barkai` |
| `generative_ui_agents/ai-dashboard-canvas-agent/` | `The MIT License  Copyright (c) Atai Barkai` |
| `generative_ui_agents/ai-mcp-app-builder/` | `The MIT License  Copyright (c) Atai Barkai` |
| `generative_ui_agents/ai-shadcn-component-generator/` | `The MIT License  Copyright (c) Tyler Slaton` |

Treat those 5 subprojects as **MIT-licensed with named upstream authors**, not as Apache-2.0 works by this
repo's owner.

**Inconsistency to flag:** `rag_tutorials/knowledge_graph_rag_citations/README.md` ends with a `## 📝 License`
section reading exactly `MIT License`, while the repo root is Apache-2.0 and that directory contains **no**
`LICENSE` file (files there: `Dockerfile`, `README.md`, `docker-compose.yml`, `knowledge_graph_rag.py`,
`requirements.txt`). **The license for that app is ambiguous** — README says MIT, repo root says Apache-2.0,
and no LICENSE file disambiguates. Flag as UNKNOWN pending owner clarification before reuse.

`agent_skills/registry.json` declares a per-skill `license` field. All **7** registered entries read
`"license": "Apache-2.0"`; registry metadata authors are `Shubham Saboo` and `Matt Van Horn` (one entry,
`first-reader`, has **empty** license and **null** author). A **second, 8th skill directory** exists on disk
and in the README (`self-improving-agent-skills`) that is **absent from `registry.json`** — its declared
license is **UNKNOWN** (it inherits root Apache-2.0 by default, but is not registry-attested).

### Repo-wide build metadata (scraped across all 119 README-linked dirs)

- Directories containing a `requirements.txt`: **97**
- Directories containing a `package.json`: **9**
- Directories containing a `pyproject.toml`: **2**
- Directories containing any license-named file: **5** (all MIT, all under `generative_ui_agents/`)

---

## 2. Actual top-level directory structure

Scraped from `https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main`. **12 directories, 4 files.**

### Directories (verbatim)

```
.github/workflows/
advanced_ai_agents/
advanced_llm_apps/
agent_skills/
ai_agent_framework_crash_course/
always_on_agents/
docs/
generative_ui_agents/
mcp_ai_agents/
rag_tutorials/
starter_ai_agents/
voice_ai_agents/
```

### Files (verbatim)

```
.gitattributes
.gitignore
LICENSE
README.md
```

### Direct child directories per top-level dir (verbatim scrape)

| Top-level dir | # dirs | Child directories |
|---|---|---|
| `.github/workflows/` | 0 | _(none)_  · files: `claude.yml`, `skill-evals.yml` |
| `advanced_ai_agents/` | 3 | `autonomous_game_playing_agent_apps`, `multi_agent_apps`, `single_agent_apps` |
| `advanced_llm_apps/` | 12 | `chat-with-tarots`, `chat_with_X_tutorials`, `cursor_ai_experiments`, `gpt_oss_critique_improvement_loop`, `llm_apps_with_memory_tutorials`, `llm_finetuning_tutorials`, `llm_optimization_tools`, `multimodal_video_moment_finder`, `needle`, `resume_job_matcher`, `ripple`, `thinkpath_chatbot_app` |
| `agent_skills/` | 9 | `advisor-orchestrator-worker`, `commit-archaeologist`, `dependency-doctor`, `evals`, `first-reader`, `project-graveyard`, `scope-creep-detector`, `self-improving-agent-skills`, `thinking-out-loud`  · files: `README.md`, `registry.json` |
| `ai_agent_framework_crash_course/` | 2 | `google_adk_crash_course`, `openai_sdk_crash_course` |
| `always_on_agents/` | 2 | `always_on_hn_briefing_agent`, `release_radar_agent` |
| `docs/` | 2 | `banner`, `gallery` |
| `generative_ui_agents/` | 8 | `ai-dashboard-canvas-agent`, `ai-deep-research-agent`, `ai-financial-coach-agent`, `ai-knowledge-explorer`, `ai-mcp-app-builder`, `ai-shadcn-component-generator`, `generative-ui-starter-project`, `mcp-apps-generative-ui-showcase`  · files: `README.md` |
| `mcp_ai_agents/` | 7 | `ai_travel_planner_mcp_agent_team`, `browser_mcp_agent`, `github_mcp_agent`, `multi_mcp_agent`, `multi_mcp_agent_router`, `notion_mcp_agent`, `openai_remote_mcp_bridge` |
| `rag_tutorials/` | 24 | `agentic_rag_embedding_gemma`, `agentic_rag_gpt5`, `agentic_rag_math_agent`, `agentic_rag_with_reasoning`, `agentic_typed_rag_pydanticai`, `ai_blog_search`, `autonomous_rag`, `contextualai_rag_agent`, `corrective_rag`, `deepseek_local_rag_agent`, `gemini_agentic_rag`, `hybrid_search_rag`, `knowledge_graph_rag_citations`, `llama3.1_local_rag`, `local_hybrid_search_rag`, `local_rag_agent`, `multimodal_agentic_rag`, `qwen_local_rag`, `rag-as-a-service`, `rag_agent_cohere`, `rag_chain`, `rag_database_routing`, `rag_failure_diagnostics_clinic`, `vision_rag` |
| `starter_ai_agents/` | 17 | `ai_blog_to_podcast_agent`, `ai_breakup_recovery_agent`, `ai_data_analysis_agent`, `ai_data_visualisation_agent`, `ai_life_insurance_advisor_agent`, `ai_medical_imaging_agent`, `ai_meme_generator_agent_browseruse`, `ai_music_generator_agent`, `ai_reasoning_agent`, `ai_startup_trend_analysis_agent`, `ai_travel_agent`, `ai_x402_paying_agent`, `mixture_of_agents`, `multimodal_ai_agent`, `openai_research_agent`, `web_scraping_ai_agent`, `xai_finance_agent` |
| `voice_ai_agents/` | 4 | `ai_audio_tour_agent`, `customer_support_voice_agent`, `insurance_claim_live_agent_team`, `voice_rag_openaisdk` |

### Deeper structure under the audited subtrees (verbatim scrape)

```
advanced_ai_agents/
├── autonomous_game_playing_agent_apps/   (3 dirs)
├── multi_agent_apps/                      (16 dirs + agent_teams/)
└── single_agent_apps/                     (18 dirs)

advanced_ai_agents/multi_agent_apps/agent_teams/   (17 dirs)
├── ag2_adaptive_research_team, ai_competitor_intelligence_agent_team,
├── ai_finance_agent_team, ai_game_design_agent_team, ai_legal_agent_team,
├── ai_real_estate_agent_team, ai_recruitment_agent_team,
├── ai_sales_intelligence_agent_team, ai_seo_audit_team, ai_services_agency,
├── ai_teaching_agent_team, ai_travel_planner_agent_team,
├── ai_vc_due_diligence_agent_team, llm_panel_agent_team,
├── multimodal_coding_agent_team, multimodal_design_agent_team,
└── multimodal_uiux_feedback_agent_team

advanced_ai_agents/single_agent_apps/   (18 dirs)
├── ai_agent_governance, ai_consultant_agent, ai_customer_support_agent,
├── ai_deep_research_agent, ai_email_gtm_reachout_agent, ai_fraud_investigation_agent,
├── ai_health_fitness_agent, ai_investment_agent, ai_journalist_agent,
├── ai_meeting_agent, ai_movie_production_agent, ai_personal_finance_agent,
├── ai_recipe_meal_planning_agent, ai_startup_insight_fire1_agent, ai_system_architect_r1,
├── earnings_call_analyst_agent, research_agent_gemini_interaction_api,
└── windows_use_autonomous_agent

advanced_ai_agents/multi_agent_apps/   (16 dirs + agent_teams/)
├── agent_teams/, ai_aqi_analysis_agent, ai_codebase_migration_agent,
├── ai_domain_deep_research_agent, ai_email_gtm_outreach_agent, ai_financial_coach_agent,
├── ai_home_renovation_agent, ai_mental_wellbeing_agent, ai_negotiation_battle_simulator,
├── ai_news_and_podcast_agents, ai_self_evolving_agent, ai_speech_trainer_agent,
├── devpulse_ai, multi_agent_researcher, multi_agent_trust_layer,
├── product_launch_intelligence_agent, trust_gated_agent_team

advanced_llm_apps/llm_apps_with_memory_tutorials/   (7 dirs on disk, 6 in README)
├── adk_career_coach_agent_memory, ai_arxiv_agent_memory, ai_travel_agent_memory,
├── llama3_stateful_chat, llm_app_personalized_memory, local_chatgpt_with_memory,
└── multi_llm_memory

advanced_llm_apps/llm_optimization_tools/   (2 dirs + README.md)
├── headroom_context_optimization, toonify_token_optimization

advanced_llm_apps/llm_finetuning_tutorials/   (2 dirs)
└── gemma3_finetuning, llama3.2_finetuning

agent_skills/   (8 skill dirs + evals/ + README.md + registry.json)
├── advisor-orchestrator-worker, commit-archaeologist, dependency-doctor, evals,
├── first-reader, project-graveyard, scope-creep-detector, self-improving-agent-skills,
└── thinking-out-loud
```

### Structural gaps: README vs. actual tree

The README is **not** a complete index. Directories present on disk but **absent from the README**:

- `rag_tutorials/` — **24 dirs on disk, 21 in README.** Unlisted: `agentic_rag_gpt5`, `agentic_rag_math_agent`,
  `qwen_local_rag`.
- `advanced_llm_apps/` — README surfaces only `needle/`, `ripple/`, `llm_apps_with_memory_tutorials/`,
  `chat_with_X_tutorials/`, `llm_optimization_tools/`, `llm_finetuning_tutorials/`. **Unlisted dirs:**
  `chat-with-tarots`, `cursor_ai_experiments`, `gpt_oss_critique_improvement_loop`,
  `multimodal_video_moment_finder`, `resume_job_matcher`, `thinkpath_chatbot_app`.
- `advanced_ai_agents/single_agent_apps/` (18 on disk) — unlisted: `ai_agent_governance`,
  `ai_customer_support_agent`, `ai_email_gtm_reachout_agent`, `ai_personal_finance_agent`,
  `ai_recipe_meal_planning_agent`, `ai_startup_insight_fire1_agent`, `windows_use_autonomous_agent`.
- `advanced_ai_agents/multi_agent_apps/` — unlisted: `ai_aqi_analysis_agent`,
  `ai_codebase_migration_agent`, `ai_domain_deep_research_agent`, `ai_email_gtm_outreach_agent`,
  `ai_negotiation_battle_simulator`, `ai_speech_trainer_agent`, `multi_agent_researcher`,
  `multi_agent_trust_layer`.
- `mcp_ai_agents/` — `multi_mcp_agent` is **unlisted** (`multi_mcp_agent_router` is listed).
- `agent_skills/` — `evals/` (the CI harness) is unlisted.
- `generative_ui_agents/` — `ai-knowledge-explorer` is unlisted (8 on disk, 7 in README).
- `starter_ai_agents/` (17 on disk, 13 in README) — unlisted: `ai_data_visualisation_agent`,
  `ai_life_insurance_advisor_agent`, `ai_reasoning_agent`, `ai_startup_trend_analysis_agent`.
- `advanced_ai_agents/multi_agent_apps/agent_teams/` — `ai_seo_audit_team` is unlisted (17 on disk, 16 listed).
- `docs/` contains only `banner/` and `gallery/` — **no code**.

---

## 3. Category-by-category inventory (README text as stated)

All **121** README app entries parsed across **16** `###` sections under `## 📂 Browse all templates`.
App names, paths and one-line descriptions below are **verbatim** from the README (emoji retained;
descriptions unaltered). Descriptions that were visibly truncated in the source README are marked
**(truncated in README)**.

**Section taglines, quoted:**

- **🧩 Agent Skills** — *Give your coding agent new abilities. One command to install, plain English to use. Every skill ships real code and passes a security + eval CI gate. Works with Claude Code, Codex, Cursor, and other coding agents. [Browse all skills →](agent_skills/)*  (8 entries)
- **🌱 Starter AI Agents** — *Single-file agents that run with just an API key - a great place to start.*  (13 entries)
- **🚀 Advanced AI Agents** — *Production-style agents with tools, memory, and multi-step reasoning.*  (22 entries)
- **🛰️ Always-on Agents** — *Background agents that run on schedules or events, monitor changing context, decide what needs attention, and proactively deliver updates, artifacts, or actions.*  (2 entries)
- **🤝 Multi-agent Teams** — *Multiple agents collaborating to accomplish complex, cross-domain tasks.*  (14 entries)
- **🗣️ Voice AI Agents** — *Speech-in, speech-out agents using real-time voice APIs.*  (5 entries)
- **🖼️ Generative UI and Agentic Frontends** — *Agents that render interactive UI components, not just text: forms, cards, charts, editable plans.*  (7 entries)
- **🎮 Autonomous Game-Playing Agents** — *Agents that play games end-to-end: reasoning, strategy, and action.*  (3 entries)
- **♾️ MCP AI Agents** — *Agents that connect to external tools and data via Model Context Protocol.*  (6 entries)
- **📀 RAG (Retrieval Augmented Generation)** — *Retrieval pipelines, from simple chains to agentic and multi-source.*  (21 entries)
- **🔎 AI Browser Tools** — *Small tools that bring AI into everyday browsing.*  (2 entries)
- **💾 LLM Apps with Memory** — *Agents and chatbots that remember conversations and user state across sessions.*  (6 entries)
- **💬 Chat with X** — *Turn any data source into a chat interface.*  (6 entries)
- **🎯 LLM Optimization Tools** — *Reduce token usage, context size, and API cost without losing quality.*  (2 entries)
- **🔧 LLM Fine-tuning** — *End-to-end fine-tuning recipes for open-source models.*  (2 entries)
- **🧑‍🏫 AI Agent Framework Crash Courses** — *Deep-dive tutorials on the major agent frameworks.*  (2 entries)

---

### 🧩 Agent Skills

*README tagline, quoted:* "Give your coding agent new abilities. One command to install, plain English to use. Every skill ships real code and passes a security + eval CI gate. Works with Claude Code, Codex, Cursor, and other coding agents. [Browse all skills →](agent_skills/)"

*Audit note:* `agent_skills/` — 8 dirs on disk; `registry.json` attests only 7.

| # | App (README name) | Directory path | Description (README, verbatim) |
|---|---|---|---|
| 1 | ⚰️ Project Graveyard | `agent_skills/project-graveyard/` | Finds every side project you abandoned, tells you why each one died, and helps you finish the one worth going back to |
| 2 | 👁️ First Reader | `agent_skills/first-reader/` | Simulates real readers going through your draft and reports where they lose interest, where they stop reading, and what they remember afterward, without rewriting a word |
| 3 | 🔭 Scope Creep Detector | `agent_skills/scope-creep-detector/` | Checks whether a diff grew beyond its stated intent and recommends what to keep, split, or justify |
| 4 | 🏺 Commit Archaeologist | `agent_skills/commit-archaeologist/` | Reconstructs why a file or code region exists from its introducing commit, later edits, co-changes, and intent clues |
| 5 | 🩺 Dependency Doctor | `agent_skills/dependency-doctor/` | Checks a dependency manifest for standard-library pins, obsolete backports, unpinned entries, duplicate constraints, and yanked releases |
| 6 | 🧠 Advisor Orchestrator Worker | `agent_skills/advisor-orchestrator-worker/` | Meta Loop with Claude Fable 5.1 as advisor, GPT-6 Astra as orchestrator, and Gemini 3.8 Flash as worker |
| 7 | 🎙️ Thinking Out Loud | `agent_skills/thinking-out-loud/` | Echoes a voice ramble back as a scannable brief, with the model's guesses quarantined and your reversals flagged |
| 8 | ♾️ Self-Improving Agent Skills | `agent_skills/self-improving-agent-skills/` | Automatically optimize agent skills using Gemini and ADK |

### 🌱 Starter AI Agents

*README tagline, quoted:* "Single-file agents that run with just an API key - a great place to start."

*Audit note:* 17 dirs on disk, 13 listed in README.

| # | App (README name) | Directory path | Description (README, verbatim) |
|---|---|---|---|
| 1 | 🎙️ AI Blog to Podcast Agent | `starter_ai_agents/ai_blog_to_podcast_agent/` | Turn any blog URL into a narrated podcast episode |
| 2 | ❤️‍🩹 AI Breakup Recovery Agent | `starter_ai_agents/ai_breakup_recovery_agent/` | An agent team that talks you through the post-breakup spiral |
| 3 | 📊 AI Data Analysis Agent | `starter_ai_agents/ai_data_analysis_agent/` | Ask questions of any CSV or Excel file in plain English |
| 4 | 🩻 AI Medical Imaging Agent | `starter_ai_agents/ai_medical_imaging_agent/` | Diagnostic analysis of X-rays and scans with Gemini |
| 5 | 😂 AI Meme Generator Agent (Browser) | `starter_ai_agents/ai_meme_generator_agent_browseruse/` | Makes memes by driving a real browser, not an image API |
| 6 | 🎵 AI Music Generator Agent | `starter_ai_agents/ai_music_generator_agent/` | Prompt in, MP3 track out |
| 7 | 🛫 AI Travel Agent (Local & Cloud) | `starter_ai_agents/ai_travel_agent/` | Personalized day-by-day travel itineraries |
| 8 | 💸 AI x402 Paying Agent | `starter_ai_agents/ai_x402_paying_agent/` | An agent with a wallet that pays per-call for the data it needs — no API keys |
| 9 | ✨ Gemini Multimodal Agent | `starter_ai_agents/multimodal_ai_agent/` | Video analysis plus web search in one agent |
| 10 | 🔄 Mixture of Agents | `starter_ai_agents/mixture_of_agents/` | Multiple LLMs answer, one aggregates the best response |
| 11 | 📊 xAI Finance Agent | `starter_ai_agents/xai_finance_agent/` | Real-time stock analysis powered by Grok |
| 12 | 🔍 OpenAI Research Agent | `starter_ai_agents/openai_research_agent/` | Multi-agent topic research with the OpenAI Agents SDK |
| 13 | 🕸️ Web Scraping AI Agent | `starter_ai_agents/web_scraping_ai_agent/` | Describe what to extract and the agent scrapes it |

### 🚀 Advanced AI Agents

*README tagline, quoted:* "Production-style agents with tools, memory, and multi-step reasoning."

*Audit note:* README mixes `single_agent_apps/` and `multi_agent_apps/` entries in one flat list. Includes 1 external link (out of repo).

| # | App (README name) | Directory path | Description (README, verbatim) |
|---|---|---|---|
| 1 | 🏚️ 🍌 AI Home Renovation Agent with Nano Banana Pro | `advanced_ai_agents/multi_agent_apps/ai_home_renovation_agent` | Photos of your space in, renovation plan and photorealistic renders out |
| 2 | 🧠 DevPulse AI - Multi-Agent Signal Intelligence | `advanced_ai_agents/multi_agent_apps/devpulse_ai/` | Aggregates and scores technical signals into a daily intelligence digest |
| 3 | 🔍 AI Deep Research Agent | `advanced_ai_agents/single_agent_apps/ai_deep_research_agent/` | Comprehensive web research with the OpenAI Agents SDK and Firecrawl |
| 4 | 📊 AI VC Due Diligence Agent Team | `advanced_ai_agents/multi_agent_apps/agent_teams/ai_vc_due_diligence_agent_team` | Multi-agent startup investment analysis with Gemini 3 |
| 5 | 🔬 AI Research Planner & Executor (Google Interactions API) | `advanced_ai_agents/single_agent_apps/research_agent_gemini_interaction_api` | Multi-phase research with stateful conversations and auto-generated infographics |
| 6 | 🤝 AI Consultant Agent | `advanced_ai_agents/single_agent_apps/ai_consultant_agent` | Market analysis and strategy recommendations with live web research |
| 7 | 🏗️ AI System Architect Agent | `advanced_ai_agents/single_agent_apps/ai_system_architect_r1/` | Architecture reviews using DeepSeek R1 reasoning plus Claude |
| 8 | 💰 AI Financial Coach Agent | `advanced_ai_agents/multi_agent_apps/ai_financial_coach_agent/` | Personalized budget, debt, and savings analysis |
| 9 | 🎬 AI Movie Production Agent | `advanced_ai_agents/single_agent_apps/ai_movie_production_agent/` | Script drafts and casting ideas from a one-line movie concept |
| 10 | 📈 AI Investment Agent | `advanced_ai_agents/single_agent_apps/ai_investment_agent/` | Stock comparison reports built on Yahoo Finance data |
| 11 | 📡 Earnings Call Analyst Agent | `advanced_ai_agents/single_agent_apps/earnings_call_analyst_agent/` | Turns YouTube earnings calls into a playback-synced analyst workspace |
| 12 | 🏋️‍♂️ AI Health & Fitness Agent | `advanced_ai_agents/single_agent_apps/ai_health_fitness_agent/` | Tailored diet and workout plans from your goals |
| 13 | 🚀 AI Product Launch Intelligence Agent | `advanced_ai_agents/multi_agent_apps/product_launch_intelligence_agent` | Go-to-market intelligence on competitor launches |
| 14 | 🔍 AI Fraud Investigation Agent | `advanced_ai_agents/single_agent_apps/ai_fraud_investigation_agent/` | Cross-references public records to flag facilities that don't add up |
| 15 | 🗞️ AI Journalist Agent | `advanced_ai_agents/single_agent_apps/ai_journalist_agent/` | Researches, writes, and edits articles on any topic |
| 16 | 🧠 AI Mental Wellbeing Agent | `advanced_ai_agents/multi_agent_apps/ai_mental_wellbeing_agent/` | A coordinated agent team for mental health support plans |
| 17 | 📑 AI Meeting Agent | `advanced_ai_agents/single_agent_apps/ai_meeting_agent/` | Context, industry insights, and strategy briefs before you walk in |
| 18 | 🧬 AI Self-Evolving Agent | `advanced_ai_agents/multi_agent_apps/ai_self_evolving_agent/` | Agents that rewrite their own workflows with EvoAgentX |
| 19 | 👨🏻‍💼 AI Sales Intelligence Agent Team | `advanced_ai_agents/multi_agent_apps/agent_teams/ai_sales_intelligence_agent_team` | Generates competitive sales battle cards in real time |
| 20 | 🎧 AI Social Media News and Podcast Agent | `advanced_ai_agents/multi_agent_apps/ai_news_and_podcast_agents/` | Curates your trusted sources into briefs and generated podcasts |
| 21 | 🌐 Openwork - Open Browser Automation Agent | `https://github.com/accomplish-ai/coworker` | Open-source agent that operates a real browser |
| 22 | 🛡️ Trust-Gated Multi-Agent Research Team | `advanced_ai_agents/multi_agent_apps/trust_gated_agent_team/` | Every agent verified, every action in a hash-chained audit trail |

### 🛰️ Always-on Agents

*README tagline, quoted:* "Background agents that run on schedules or events, monitor changing context, decide what needs attention, and proactively deliver updates, artifacts, or actions."

*Audit note:* 2 entries, both under `always_on_agents/`. This is the repo's only 'autonomous/background' category.

| # | App (README name) | Directory path | Description (README, verbatim) |
|---|---|---|---|
| 1 | 📰 Always-on Hacker News Briefing Agent | `always_on_agents/always_on_hn_briefing_agent/` | A scheduled scout that ships a ranked daily brief to Slack or email |
| 2 | 📡 Release Radar Agent | `always_on_agents/release_radar_agent/` | Watches dependency releases and briefs you on breaking, deprecated, security, and major-version changes |

### 🤝 Multi-agent Teams

*README tagline, quoted:* "Multiple agents collaborating to accomplish complex, cross-domain tasks."

*Audit note:* All 14 paths live under `advanced_ai_agents/multi_agent_apps/agent_teams/` (17 dirs on disk; `ai_seo_audit_team` unlisted).

| # | App (README name) | Directory path | Description (README, verbatim) |
|---|---|---|---|
| 1 | 🧲 AI Competitor Intelligence Agent Team | `advanced_ai_agents/multi_agent_apps/agent_teams/ai_competitor_intelligence_agent_team/` | Structured competitor teardowns built from their own websites |
| 2 | 💲 AI Finance Agent Team | `advanced_ai_agents/multi_agent_apps/agent_teams/ai_finance_agent_team/` | A financial analyst team in 20 lines of Python |
| 3 | 🎨 AI Game Design Agent Team | `advanced_ai_agents/multi_agent_apps/agent_teams/ai_game_design_agent_team/` | Full game concepts from a swarm of design specialists |
| 4 | 🧭 AG2 Adaptive Research Team | `advanced_ai_agents/multi_agent_apps/agent_teams/ag2_adaptive_research_team/` | Agent teamwork with routing and fallback, built on AG2 |
| 5 | 👨‍⚖️ AI Legal Agent Team (Cloud & Local) | `advanced_ai_agents/multi_agent_apps/agent_teams/ai_legal_agent_team/` | Research, contract analysis, and strategy from a full legal bench |
| 6 | 💼 AI Recruitment Agent Team | `advanced_ai_agents/multi_agent_apps/agent_teams/ai_recruitment_agent_team/` | Resume screening to interview scheduling, end to end |
| 7 | 🏠 AI Real Estate Agent Team | `advanced_ai_agents/multi_agent_apps/agent_teams/ai_real_estate_agent_team` | Property search, market analysis, and recommendations |
| 8 | 👨‍💼 AI Services Agency (CrewAI) | `advanced_ai_agents/multi_agent_apps/agent_teams/ai_services_agency/` | A digital agency that scopes and plans your software project |
| 9 | 👨‍🏫 AI Teaching Agent Team | `advanced_ai_agents/multi_agent_apps/agent_teams/ai_teaching_agent_team/` | A faculty of agents that builds your complete learning path |
| 10 | 💻 Multimodal Coding Agent Team | `advanced_ai_agents/multi_agent_apps/agent_teams/multimodal_coding_agent_team/` | Snap a photo of a coding problem, get a sandboxed solution |
| 11 | ✨ Multimodal Design Agent Team | `advanced_ai_agents/multi_agent_apps/agent_teams/multimodal_design_agent_team/` | Design critiques from a Gemini-powered expert panel |
| 12 | 🎨 🍌 Multimodal UI/UX Feedback Agent Team | `advanced_ai_agents/multi_agent_apps/agent_teams/multimodal_uiux_feedback_agent_team/` | Landing page feedback plus an auto-generated improved version |
| 13 | 🌏 AI Travel Planner Agent Team | `advanced_ai_agents/multi_agent_apps/agent_teams/ai_travel_planner_agent_team/` | A complete trip itinerary, crafted by a team |
| 14 | ⚖️ LLM Panel Agent Team | `advanced_ai_agents/multi_agent_apps/agent_teams/llm_panel_agent_team/` | Three vendors review the same diff blind, then argue it out anonymously |

### 🗣️ Voice AI Agents

*README tagline, quoted:* "Speech-in, speech-out agents using real-time voice APIs."

*Audit note:* 4 in-repo paths + 1 external link.

| # | App (README name) | Directory path | Description (README, verbatim) |
|---|---|---|---|
| 1 | 🗣️ AI Audio Tour Agent | `voice_ai_agents/ai_audio_tour_agent/` | Self-guided audio tours from your location, interests, and pace |
| 2 | 📞 Customer Support Voice Agent | `voice_ai_agents/customer_support_voice_agent/` | Voice answers grounded in your own docs |
| 3 | 🛡️ Insurance Claim Live Agent Team | `voice_ai_agents/insurance_claim_live_agent_team/` | Voice claim intake on Gemini 3.8 Live that writes a field notebook, looks at damage through the webcam, and sketches the incident |
| 4 | 🔊 Voice RAG Agent (OpenAI SDK) | `voice_ai_agents/voice_rag_openaisdk/` | Ask your PDFs questions, hear the answers |
| 5 | 🎙️ OpenSource Voice Dictation Agent (Wispr Flow clone) | `https://github.com/akshayaggarwal99/jarvis-ai-assistant` | Open-source dictation that types where you talk |

### 🖼️ Generative UI and Agentic Frontends

*README tagline, quoted:* "Agents that render interactive UI components, not just text: forms, cards, charts, editable plans."

*Audit note:* 8 dirs on disk, 7 listed (`ai-knowledge-explorer` unlisted). All 5 nested MIT LICENSEs live here.

| # | App (README name) | Directory path | Description (README, verbatim) |
|---|---|---|---|
| 1 | 🗂️ Generative UI Starter Project | `generative_ui_agents/generative-ui-starter-project/` | A chat-driven kanban board you and the agent work together |
| 2 | 🪙 AI Financial Coach Agent | `generative_ui_agents/ai-financial-coach-agent/` | Budget, savings, and debt plans rendered as interactive cards |
| 3 | 📊 AI Dashboard Canvas Agent | `generative_ui_agents/ai-dashboard-canvas-agent/` | Describe a dashboard in chat, charts assemble on a live canvas |
| 4 | 🛠️ AI MCP App Builder | `generative_ui_agents/ai-mcp-app-builder/` | Describe an MCP app, get a live sandboxed instance back |
| 5 | ✈️ MCP Apps Generative UI Showcase | `generative_ui_agents/mcp-apps-generative-ui-showcase/` | MCP apps that render real interactive UI, flight search included |
| 6 | 🎛️ AI Shadcn Component Generator | `generative_ui_agents/ai-shadcn-component-generator/` | Chat your way to production-ready shadcn components |
| 7 | 🔍 AI Deep Research Agent | `generative_ui_agents/ai-deep-research-agent/` | Research where every tool call renders as a live workspace card |

### 🎮 Autonomous Game-Playing Agents

*README tagline, quoted:* "Agents that play games end-to-end: reasoning, strategy, and action."

*Audit note:* 3 entries, all under `advanced_ai_agents/autonomous_game_playing_agent_apps/`.

| # | App (README name) | Directory path | Description (README, verbatim) |
|---|---|---|---|
| 1 | 🎮 AI 3D Pygame Agent | `advanced_ai_agents/autonomous_game_playing_agent_apps/ai_3dpygame_r1/` | DeepSeek R1 writes PyGame code, browser agents run it live |
| 2 | ♜ AI Chess Agent | `advanced_ai_agents/autonomous_game_playing_agent_apps/ai_chess_agent/` | Agent White vs Agent Black with validated moves |
| 3 | 🎲 AI Tic-Tac-Toe Agent | `advanced_ai_agents/autonomous_game_playing_agent_apps/ai_tic_tac_toe_agent/` | Two different LLMs battle it out, move by move |

### ♾️ MCP AI Agents

*README tagline, quoted:* "Agents that connect to external tools and data via Model Context Protocol."

*Audit note:* 7 dirs on disk, 6 listed (`multi_mcp_agent` unlisted).

| # | App (README name) | Directory path | Description (README, verbatim) |
|---|---|---|---|
| 1 | ♾️ Browser MCP Agent | `mcp_ai_agents/browser_mcp_agent/` | Drive a real browser with natural language over MCP |
| 2 | 🐙 GitHub MCP Agent | `mcp_ai_agents/github_mcp_agent/` | Explore and analyze any repo in plain English |
| 3 | 📑 Notion MCP Agent | `mcp_ai_agents/notion_mcp_agent` | Talk to your Notion pages from the terminal |
| 4 | 🌍 AI Travel Planner MCP Agent | `mcp_ai_agents/ai_travel_planner_mcp_agent_team` | Itineraries built on live Airbnb and Google Maps data |
| 5 | 🔀 Multi-MCP Agent Router | `mcp_ai_agents/multi_mcp_agent_router/` | Specialist agents, each wired to its own MCP server |
| 6 | 🔌 OpenAI Remote MCP Tool Bridge | `mcp_ai_agents/openai_remote_mcp_bridge/` | Connect OpenAI function calling directly to a remote MCP server |

### 📀 RAG (Retrieval Augmented Generation)

*README tagline, quoted:* "Retrieval pipelines, from simple chains to agentic and multi-source."

*Audit note:* **24 dirs on disk, 21 listed.** Unlisted: `agentic_rag_gpt5`, `agentic_rag_math_agent`, `qwen_local_rag`.

| # | App (README name) | Directory path | Description (README, verbatim) |
|---|---|---|---|
| 1 | 🔥 Agentic RAG with Embedding Gemma | `rag_tutorials/agentic_rag_embedding_gemma` | Fully local agentic RAG with EmbeddingGemma and Llama 3.2 |
| 2 | 🧐 Agentic RAG with Reasoning | `rag_tutorials/agentic_rag_with_reasoning/` | Watch the agent's step-by-step reasoning as it retrieves |
| 3 | 📰 AI Blog Search (RAG) | `rag_tutorials/ai_blog_search/` | Agentic search over blog content, built on LangGraph |
| 4 | 🔍 Autonomous RAG | `rag_tutorials/autonomous_rag/` | GPT-4o answers from your PDFs, falls back to web search |
| 5 | 🔄 Contextual AI RAG Agent | `rag_tutorials/contextualai_rag_agent/` | Managed RAG: datastore to grounded chat in minutes |
| 6 | 🔄 Corrective RAG (CRAG) | `rag_tutorials/corrective_rag/` | Retrieval that grades itself and retries before answering |
| 7 | 📎 Typed Agentic RAG with Pydantic AI | `rag_tutorials/agentic_typed_rag_pydanticai/` | Validated answers with exact citations, or a refusal when evidence is weak |
| 8 | 🐋 Deepseek Local RAG Agent | `rag_tutorials/deepseek_local_rag_agent/` | Local DeepSeek reasoning over your own documents |
| 9 | 🤔 Gemini Agentic RAG | `rag_tutorials/gemini_agentic_rag/` | Query rewriting and web fallback with Gemini Flash Thinking |
| 10 | 👀 Hybrid Search RAG (Cloud) | `rag_tutorials/hybrid_search_rag/` | Keyword plus vector search feeding Claude |
| 11 | 🔄 Llama 3.1 Local RAG | `rag_tutorials/llama3.1_local_rag/` | Chat with any webpage, fully offline |
| 12 | 🖥️ Local Hybrid Search RAG | `rag_tutorials/local_hybrid_search_rag/` | Hybrid search with everything running on your machine |
| 13 | 🧬 Multimodal Agentic RAG | `rag_tutorials/multimodal_agentic_rag/` | Text, PDFs, images, audio, and video, answered with citations |
| 14 | 🦙 Local RAG Agent | `rag_tutorials/local_rag_agent/` | Llama 3.2 and Qdrant, no API keys required |
| 15 | 🧩 RAG-as-a-Service | `rag_tutorials/rag-as-a-service/` | A production RAG service in under 50 lines |
| 16 | ✨ RAG Agent with Cohere | `rag_tutorials/rag_agent_cohere/` | Command R7B retrieval with web-search fallback |
| 17 | ⛓️ Basic RAG Chain | `rag_tutorials/rag_chain/` | The minimal retrieval pipeline, applied to pharma research |
| 18 | 📠 RAG with Database Routing | `rag_tutorials/rag_database_routing/` | Routes each question to the right database automatically |
| 19 | 🖼️ Vision RAG | `rag_tutorials/vision_rag/` | Ask questions about images and PDF pages with Embed-4 |
| 20 | 🩺 RAG Failure Diagnostics Clinic | `rag_tutorials/rag_failure_diagnostics_clinic/` | Find out why your RAG pipeline is wrong, systematically |
| 21 | 🕸️ Knowledge Graph RAG with Citations | `rag_tutorials/knowledge_graph_rag_citations/` | Multi-hop answers with verifiable source attribution |

### 🔎 AI Browser Tools

*README tagline, quoted:* "Small tools that bring AI into everyday browsing."

*Audit note:* 2 entries, both under `advanced_llm_apps/`.

| # | App (README name) | Directory path | Description (README, verbatim) |
|---|---|---|---|
| 1 | 🪡 Needle - A New Way to Find | `advanced_llm_apps/needle/` | Search webpages by meaning and highlight the strongest source sentence, using a Chrome extension powered by TypeSafe Jev |
| 2 | 🌀 Ripple - Change One Thing, Find What Else Needs to Change | `advanced_llm_apps/ripple/` | Find related inconsistencies and suggested fixes as you edit a Google Doc, using TypeSafe Jev and Gemini |

### 💾 LLM Apps with Memory

*README tagline, quoted:* "Agents and chatbots that remember conversations and user state across sessions."

*Audit note:* **7 dirs on disk, 6 listed** (`adk_career_coach_agent_memory` unlisted).

| # | App (README name) | Directory path | Description (README, verbatim) |
|---|---|---|---|
| 1 | 💾 AI ArXiv Agent with Memory | `advanced_llm_apps/llm_apps_with_memory_tutorials/ai_arxiv_agent_memory/` | Paper search that remembers your research interests |
| 2 | 🛩️ AI Travel Agent with Memory | `advanced_llm_apps/llm_apps_with_memory_tutorials/ai_travel_agent_memory/` | A travel assistant that remembers your preferences |
| 3 | 💬 Llama3 Stateful Chat | `advanced_llm_apps/llm_apps_with_memory_tutorials/llama3_stateful_chat/` | Session-persistent chat with Llama 3 |
| 4 | 📝 LLM App with Personalized Memory | `advanced_llm_apps/llm_apps_with_memory_tutorials/llm_app_personalized_memory/` | A chatbot that keeps context across conversations |
| 5 | 🗄️ Local ChatGPT Clone with Memory | `advanced_llm_apps/llm_apps_with_memory_tutorials/local_chatgpt_with_memory/` | Fully local, with a personal memory per user |
| 6 | 🧠 Multi-LLM Application with Shared Memory | `advanced_llm_apps/llm_apps_with_memory_tutorials/multi_llm_memory/` | Different models, one shared conversation memory |

### 💬 Chat with X

*README tagline, quoted:* "Turn any data source into a chat interface."

*Audit note:* All 6 paths under `advanced_llm_apps/chat_with_X_tutorials/`.

| # | App (README name) | Directory path | Description (README, verbatim) |
|---|---|---|---|
| 1 | 💬 Chat with GitHub (GPT & Llama3) | `advanced_llm_apps/chat_with_X_tutorials/chat_with_github/` | Any repo, answered in 30 lines of RAG |
| 2 | 📨 Chat with Gmail | `advanced_llm_apps/chat_with_X_tutorials/chat_with_gmail/` | Ask your inbox questions |
| 3 | 📄 Chat with PDF (GPT & Llama3) | `advanced_llm_apps/chat_with_X_tutorials/chat_with_pdf/` | The classic, in 30 lines of Python |
| 4 | 📚 Chat with Research Papers (ArXiv) (GPT & Llama3) | `advanced_llm_apps/chat_with_X_tutorials/chat_with_research_papers/` | Explore arXiv conversationally with GPT-4o |
| 5 | 📝 Chat with Substack | `advanced_llm_apps/chat_with_X_tutorials/chat_with_substack/` | Chat with any newsletter's archive |
| 6 | 📽️ Chat with YouTube Videos | `advanced_llm_apps/chat_with_X_tutorials/chat_with_youtube_videos/` | Ask videos questions via their transcripts |

### 🎯 LLM Optimization Tools

*README tagline, quoted:* "Reduce token usage, context size, and API cost without losing quality."

*Audit note:* 2 entries, both under `advanced_llm_apps/llm_optimization_tools/` (dir also has a `README.md`).

| # | App (README name) | Directory path | Description (README, verbatim) |
|---|---|---|---|
| 1 | 🎯 Toonify Token Optimization | `advanced_llm_apps/llm_optimization_tools/toonify_token_optimization/` | Reduce LLM API costs by 30-60% using TOON format |
| 2 | 🧠 Headroom Context Optimization | `advanced_llm_apps/llm_optimization_tools/headroom_context_optimization/` | Reduce LLM API costs by 50-90% |

### 🔧 LLM Fine-tuning

*README tagline, quoted:* "End-to-end fine-tuning recipes for open-source models."

*Audit note:* 2 entries, both under `advanced_llm_apps/llm_finetuning_tutorials/`.

| # | App (README name) | Directory path | Description (README, verbatim) |
|---|---|---|---|
| 1 | 🦥 Gemma 3 Fine-tuning | `advanced_llm_apps/llm_finetuning_tutorials/gemma3_finetuning/` | 4-bit LoRA with Unsloth, small and readable |
| 2 | 🦙 Llama 3.2 Fine-tuning | `advanced_llm_apps/llm_finetuning_tutorials/llama3.2_finetuning/` | Fine-tune in 30 lines, free on Colab |

### 🧑‍🏫 AI Agent Framework Crash Courses

*README tagline, quoted:* "Deep-dive tutorials on the major agent frameworks."

*Audit note:* 2 entries, the only crash-course section.

| # | App (README name) | Directory path | Description (README, verbatim) |
|---|---|---|---|
| 1 | Google ADK Crash Course | `ai_agent_framework_crash_course/google_adk_crash_course/` | Starter agent, structured outputs, tools (built-in, function, third-party, MCP), memory, callbacks, plugins, and multi-agent patterns. Model-agnostic. |
| 2 | OpenAI Agents SDK Crash Course | `ai_agent_framework_crash_course/openai_sdk_crash_course/` | Starter agent, function calling, structured outputs, tools, memory, evaluation, handoffs, swarm orchestration, and routing logic. |

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