# Agent Maintainer Memory

## Agent Ecosystem Snapshot

### Current Agents (8)
- `agent-maintainer` (opus, pink) - Meta-agent for reviewing/maintaining agent configs
- `e2e-test-fixer` (sonnet, explicit tools) - TDD RED-to-GREEN implementation
- `codebase-refactor-auditor` (sonnet, explicit tools, no Skill) - Post-implementation code optimization
- `architecture-docs-maintainer` (sonnet, blue) - Architectural pattern documentation
- `infrastructure-docs-maintainer` (sonnet, purple) - Tool/infra documentation
- `product-specs-architect` (opus, purple) - Feature design, schemas, E2E specs
- `tdd-pipeline-maintainer` (opus, pink) - TDD automation pipeline maintenance
- `website-editor` (opus, green) - Marketing website maintenance

### Current Skills (8)
- `generating-e2e-tests`, `generating-effect-schemas`
- `checking-best-practices`, `detecting-code-duplication`, `validating-config`
- `tracking-dependencies`, `validating-json-schemas`, `scanning-security`

## Review Patterns Learned

### Common Issues Found Across Agent Reviews
- **Missing Tool Access documentation**: Agents need `<!-- Tool Access -->` HTML comment block after YAML frontmatter
- **Description format**: Use YAML block scalar (`|-`) not double-quoted strings with `\n` escapes
- **Example XML structure**: Descriptions need `<example>` with `<commentary>` AND `<non-example>` blocks
- **Model Rationale**: Add `# Model Rationale:` comment before `color:` explaining why the model was chosen
- **Agent Type declaration**: System prompt should start with `## Agent Type:` section defining authority boundaries
- **Collaborative patterns**: CREATIVE agents need workflow examples showing clarifying questions and trade-off presentation
- **Self-correction protocol**: All agents need verification steps before presenting work to user
- **Cross-agent coordination**: Document which agents to coordinate with and on what topics
- **Success metrics**: Define measurable criteria for when the agent's work is considered successful

### Playwright MCP Tool Integration Pattern
- Agents using Playwright browser tools need: Tool Access comment listing specific MCP tools, ToolSearch loading protocol, responsive breakpoint table (375/768/1440), wait-after-navigation pattern, 2-3 failure threshold before asking user
- Playwright tools are deferred -- must document `ToolSearch("select:<tool_name>")` loading in agent prompt
- Playwright auto-launches Chromium on first call -- no external browser or extension needed
- Use ref-based interactions: `browser_snapshot()` to get element refs, then `browser_click({ ref })` for clicks (more reliable than coordinate-based)
- Refs are ephemeral -- re-snapshot after navigation or DOM changes to get fresh refs
- Use `browser_handle_dialog({ action: "dismiss" })` if a page triggers alerts/dialogs
- Use `http://` not `https://` for localhost URLs
- Close browser with `browser_close()` when done testing

### Review History
- `website-editor` (2026-02-20): Full rewrite -- added tool access docs, YAML block scalar description, 5 examples + 2 non-examples, agent type section, collaborative workflows, self-correction protocol, coordination table, success metrics, quality checklist
- `website-editor` (2026-02-20): Chrome MCP integration -- added Chrome Visual Testing Commands section, Chrome-Based Visual Testing section (6-step workflow, verification matrix, troubleshooting table, constraints), updated Self-Correction Visual Verification with Chrome tools, updated Tool Access justification with 8 MCP tools
- `website-editor` (2026-02-20): Apple Design grade standards -- added Design Excellence Standard section (7 principles, spacing table, transition table, anti-patterns), enhanced Quality Checklist (design excellence + brand coherence + technical + cross-page sections), added Design Refinement Check to Self-Correction Protocol, updated Success Metrics with design excellence criteria
- `brand-charter` (2026-02-20): Added 3 new sections -- Design Philosophy (4 principle cards + quality bar callout), Spacing & Whitespace (vertical rhythm table + content width table + whitespace rule callout), Transitions & Animation (duration table + motion principles do/don't). Added Design Excellence Checklist to Best Practices. Updated sidebar with 3 new links. Enhanced Visual Identity best practices with whitespace items.
- `website-editor` (2026-02-23): Schema-awareness requirements -- expanded Domain Model Reference (13-row directory map, user stories reference table, key schema concepts), added Schema-First Development section (4 rules + schema check workflow), updated Workflow (schema check as step 2, schema-consistent naming in step 6), added Schema Accuracy checklist (6 items) to Quality Checklist
- `website-editor` (2026-03-03): CI/CD workflow maintenance -- added "Website CI/CD Workflow Maintenance" section (deploy-website.yml path filter maintenance, release.yml sync-docs prompt maintenance, hardcoded count tracking, workflow consistency checklist, scope constraints). Updated: description, 6th example, core responsibilities (#7), authority boundaries, tool access comment, website structure table (added workflow files + components/i18n rows), workflow step 10, quality checklist (workflow consistency subsection), coordination table (+tdd-pipeline-maintainer), self-correction protocol (workflow check before quality gate), error handling (2 new entries), success metrics (#7), agent memory guidelines (2 new items)
- `website-editor` (2026-03-03): Vision & Progress alignment -- added "Vision & Progress Alignment" section (source documents table, when-to-check-each-document guidelines for VISION.md/SPEC-PROGRESS.md/docs/user-stories/, 5 alignment rules, Vision & Progress Check Workflow). Updated: description (+vision/progress mention), 7th example (vision/progress audit), core responsibilities (#8), tool access comment (+project documents), Schema Check Workflow (note linking to Vision workflow), Domain Model Reference (added Project-Level Documents Reference table + hierarchy explanation), Workflow (step 2 vision check), Quality Checklist (8-item Vision & Progress Alignment subsection), Self-Correction Protocol (Vision & Progress Alignment Check), Error Handling (3 new entries: tagline drift, unimplemented feature, terminology mismatch), Success Metrics (#6 vision alignment), Coordination table (expanded product-specs-architect for SPEC-PROGRESS), Agent Memory Guidelines (3 new items: tagline text, feature status, terminology mappings)
- `website-editor` (2026-03-03): Generated Schema Consistency -- added "Generated Schema Consistency" subsection inside Schema-First Development (3 documentation groups, 10-file docs page table, Generated Schema Check Workflow with 4-step cross-reference process, trigger list). Updated: description (+generated JSON Schema mention), 8th example (schema consistency audit), core responsibilities (#9), tool access comment (+generated JSON Schema), website structure table (+schemas/development/ reference, +docs pages multi-file row, +docs-components row), release.yml sync-docs section (fixed docs-schema.ts -> website/pages/docs/ multi-file, added generated schema reference paragraph, updated "when to update" list), workflow consistency checklist (+generated schema cross-ref step), Workflow (step 4 generated schema check), Quality Checklist (7-item Generated Schema Consistency subsection), Self-Correction Protocol (6-step Generated Schema Consistency Check), Error Handling (2 new entries: outdated generated schema, docs count drift), Success Metrics (#9 generated schema consistency), Agent Memory Guidelines (2 new items: verified counts, docs file structure)
- `website-editor` (2026-03-03): Chrome→Playwright MCP migration -- replaced all mcp__claude-in-chrome__* references with mcp__playwright__* equivalents. Removed Chrome extension dependency (Playwright auto-launches Chromium). Switched from coordinate-based clicks to ref-based interactions (browser_snapshot → browser_click). Removed GIF recording (replaced by sequential screenshots). Added browser_console_messages, browser_close, browser_handle_dialog. Updated: Tool Access comment (9 Playwright tools), Visual Testing Commands section (8 commands), workflow steps 13-14, Self-Correction Visual Verification (8 steps), full Visual Testing section (prerequisites, tool loading, 5-step workflow, verification matrix, troubleshooting, constraints), error handling entry. Also updated settings.local.json (+5 tool permissions) and this MEMORY.md (renamed Chrome→Playwright pattern section)
