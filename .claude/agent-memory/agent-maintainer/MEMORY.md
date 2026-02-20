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

### Chrome MCP Tool Integration Pattern
- Agents using Chrome browser tools need: Tool Access comment listing specific MCP tools, ToolSearch loading protocol, tabs_context_mcp-first requirement, responsive breakpoint table (375/768/1440), wait-after-navigation pattern, 2-3 failure threshold before asking user
- Chrome tools are deferred -- must document `ToolSearch("select:<tool_name>")` loading in agent prompt
- Use `http://` not `https://` for localhost URLs
- Never trigger JS alerts/dialogs (blocks automation)

### Review History
- `website-editor` (2026-02-20): Full rewrite -- added tool access docs, YAML block scalar description, 5 examples + 2 non-examples, agent type section, collaborative workflows, self-correction protocol, coordination table, success metrics, quality checklist
- `website-editor` (2026-02-20): Chrome MCP integration -- added Chrome Visual Testing Commands section, Chrome-Based Visual Testing section (6-step workflow, verification matrix, troubleshooting table, constraints), updated Self-Correction Visual Verification with Chrome tools, updated Tool Access justification with 8 MCP tools
- `website-editor` (2026-02-20): Apple Design grade standards -- added Design Excellence Standard section (7 principles, spacing table, transition table, anti-patterns), enhanced Quality Checklist (design excellence + brand coherence + technical + cross-page sections), added Design Refinement Check to Self-Correction Protocol, updated Success Metrics with design excellence criteria
- `brand-charter` (2026-02-20): Added 3 new sections -- Design Philosophy (4 principle cards + quality bar callout), Spacing & Whitespace (vertical rhythm table + content width table + whitespace rule callout), Transitions & Animation (duration table + motion principles do/don't). Added Design Excellence Checklist to Best Practices. Updated sidebar with 3 new links. Enhanced Visual Identity best practices with whitespace items.
