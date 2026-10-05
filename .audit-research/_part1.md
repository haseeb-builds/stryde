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
