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
