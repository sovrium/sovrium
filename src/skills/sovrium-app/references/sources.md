# Sources

Each entry: title — author or organisation — URL — date — licence (where known). "Lifted" is a paraphrase of what this skill takes from it; nothing is copied verbatim.

1. **Best practices for Claude Code** — Anthropic — https://code.claude.com/docs/en/best-practices — date not recorded — documentation.
   Lifted: give the agent a way to verify its own work; compare a screenshot against the intended design; report evidence rather than assertions.
2. **Skill authoring best practices** — Anthropic — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices — date not recorded — documentation.
   Lifted: plan → validate → execute for risky changes; name MCP tools as `Server:tool`; match the degree of freedom to how fragile the task is; one level of references.
3. **`webapp-testing` skill** — Anthropic, `anthropics/skills` — https://github.com/anthropics/skills — date not recorded — Apache-2.0.
   Lifted: recon before action (read the rendered page before interacting); wait for network idle on dynamic pages; treat scripts as black boxes.
4. **Playwright MCP** — Microsoft — https://github.com/microsoft/playwright-mcp — date not recorded — Apache-2.0.
   Lifted: accessibility snapshots as the primary structural evidence; the `browser_*` tool names in the alias table.
5. **Chrome DevTools MCP** — Chrome DevTools team — https://github.com/ChromeDevTools/chrome-devtools-mcp — date not recorded — Apache-2.0.
   Lifted: the DevTools tool names in the alias table, including the Lighthouse audit tool.
6. **Claude in Chrome** — Anthropic — https://code.claude.com/docs/en/chrome — date not recorded — documentation.
   Lifted: the Claude in Chrome tool names in the alias table; signing in through the person's own browser session.
7. **claude-code-workflows (design review)** — OneRedOak — https://github.com/OneRedOak/claude-code-workflows/tree/main/design-review — last push 2025-09-14 — MIT.
   Lifted: the desktop / tablet / mobile viewport matrix; the Blocker / High / Medium / Nitpick severity scale.
8. **Impeccable** — Paul Bakaus — https://github.com/pbakaus/impeccable — date not recorded — Apache-2.0.
   Lifted: verification in bounded passes (one inspection, one confirmation, stop) instead of an open loop.
9. **n8n skills** — n8n — https://github.com/n8n-io/skills — date not recorded — Apache-2.0.
   Lifted: a short router skill that hands off to specialist skills.
10. **Build with Agent Skills** — Model Context Protocol — https://modelcontextprotocol.io/docs/2026-07-28/develop/build-with-agent-skills — 2026-07-28 revision — documentation.
    Lifted: pairing a skill with an MCP server's tools; skills as the judgement layer above tools.
11. **writing-skills** — obra, `superpowers` — https://github.com/obra/superpowers — date not recorded — MIT.
    Lifted: descriptions that start "Use when…", list triggers, and never summarise the workflow.
12. **playwright-skill** — lackeyjb — https://github.com/lackeyjb/playwright-skill — date not recorded — MIT.
    Lifted: the script-mode fallback when no browser MCP is available.
13. **Equipping agents for the real world with Agent Skills** — Anthropic — https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills — 2025-10-16 — blog post.
    Lifted: open a skill with the capability gap it closes.

Sovrium's own behaviour (commands, status codes, restart keys, MCP refusals) comes from the manual shipped in the binary, `sovrium docs`, not from these sources.
