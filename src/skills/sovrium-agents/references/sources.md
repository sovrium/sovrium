# Sources

## Contents

- Designing tools and agents (S1, S3, S7)
- Model Context Protocol (S2, S10)
- AI security (S4–S5)
- Infrastructure (S6, S8, S9)
- Skills this one learned from (S11–S12)
- Sovrium

Each entry: title — organisation or author — URL — what was lifted. Every URL was fetched on 2026-10-24, except where marked. "Lifted" is a paraphrase; nothing is copied, and each source keeps its own licence. What Sovrium does comes from the manual of the binary you run, never from these.

## Designing tools and agents (S1, S3, S7)

- **S1 Writing effective tools for agents** — Anthropic engineering — https://www.anthropic.com/engineering/writing-tools-for-agents . Lifted: a few well-chosen tools over many; descriptions that say when to use a tool; evaluate with realistic tasks and read the transcripts.
- **S3 `mcp-builder` and its evaluation guide** — Anthropic, anthropics/skills — https://github.com/anthropics/skills/tree/main/skills/mcp-builder . Lifted: research the surface, annotate tools as read-only, destructive, idempotent or open-world, make errors actionable, then write ten realistic, read-only, independent questions with one verifiable answer each, verified against the live system before they are used.
- **S7 Building effective agents** — Anthropic engineering — https://www.anthropic.com/engineering/building-effective-agents . Lifted: prefer the simplest composition that works; closed outputs where a program branches; clear stopping conditions.

## Model Context Protocol (S2, S10)

- **S2 Tools** — Model Context Protocol — https://modelcontextprotocol.io/docs/concepts/tools . Lifted: tool annotations are hints a client uses to decide whether to ask its user; a hint from an untrusted server is not a guarantee.
- **S10 Elicitation** — Model Context Protocol specification — https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation . Lifted: a server asks the user a flat form through the client; the user can accept, decline or cancel.

## AI security (S4–S5)

- **S4 OWASP Top 10 for LLM Applications** — OWASP GenAI Security Project — https://genai.owasp.org/llm-top-10/ (the site refuses scripted fetches; read through search). Lifted: excessive agency (minimal tools, human approval for destructive actions), unbounded consumption (per-user caps), misinformation and overreliance (do not treat model output as verified).
- **S5 OWASP Agentic Security Initiative** — OWASP GenAI Security Project — https://genai.owasp.org/initiatives/agentic-security-initiative/ (read through search). Lifted: identity and privilege abuse through delegated trust; tool output treated as data, not instructions.

## Infrastructure (S6, S8, S9)

- **S6 pgvector** — https://github.com/pgvector/pgvector . Lifted: vector similarity search inside PostgreSQL, with no separate vector database.
- **S8 Ollama** — https://ollama.com/ . Lifted: a local model server; the reason local-first routing has something to route to.
- **S9 whisper.cpp** — ggml-org — https://github.com/ggml-org/whisper.cpp . Lifted: a self-hosted speech-to-text server.

## Skills this one learned from (S11–S12)

- **S11 Skill authoring best practices** — Anthropic — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices . Lifted: a description that says what and when, a copyable checklist, a validate-fix loop, one level of references, tested on a fast model.
- **S12 Equipping agents for the real world with Agent Skills** — Anthropic engineering — https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills . Lifted: progressive disclosure, which is also how a Sovrium agent loads its own `skills`.

## Sovrium

- **The Sovrium manual**, shipped in the binary: `sovrium docs ai/ai-overview`, `sovrium docs agents/ai-agents`, `sovrium docs agents/agent-approvals`, `sovrium docs agents/ai-rag`, `sovrium docs components/ai-chat-component`, `sovrium docs configuration/env-vars-ai`, `sovrium docs mcp/mcp-server`, `sovrium docs mcp/mcp-client-mode`.
