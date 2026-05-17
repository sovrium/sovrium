# Sovrium Agent Templates

Preconfigured Claude Code agent templates for common Sovrium workflows. These agents provide specialized knowledge about Sovrium's `app.yaml` configuration format, enabling faster and more accurate application building.

## What Are Agent Templates?

Agent templates are markdown files that configure Claude Code with domain-specific knowledge and workflows. When installed, they appear as available agents in Claude Code and can be launched to handle specialized tasks without needing to explain Sovrium's configuration format from scratch.

Each agent knows about:

- The `app.yaml` configuration schema and its properties
- Available field types, component types, and configuration options
- Validation commands and development workflows
- Best practices for its area of expertise

## Available Agents

### `website-editor`

Specialized for editing the visual and content aspects of a Sovrium application.

**Scope**: `pages`, `theme`, `languages`, `components`

**Use when you need to**:

- Add or edit pages (landing pages, about, pricing, blog)
- Configure page sections with component types (hero, grid, cards, forms)
- Set up theme design tokens (colors, fonts, spacing, shadows, animations)
- Add multi-language support with translation dictionaries
- Create reusable component templates
- Configure page metadata for SEO (Open Graph, Twitter Cards, structured data)
- Add page interactions (hover, click, scroll, entrance animations)

### `api-editor`

Specialized for editing the data model and backend configuration.

**Scope**: `tables`, `auth`, permissions

**Use when you need to**:

- Define data tables with typed fields and constraints
- Set up relationships between tables (one-to-one, one-to-many, many-to-many)
- Configure authentication strategies (email/password, magic link, OAuth)
- Define custom roles and permissions (table-level and field-level)
- Choose the right field type from 40+ options (text, numeric, date, selection, relational, advanced, media, user)
- Set up audit trails (created-at, updated-at, created-by, updated-by)

### `crud-editor`

Specialized for building full CRUD applications that connect data to UI.

**Scope**: `tables` + `pages` + `auth` + `components` (integrated)

**Use when you need to**:

- Build a complete feature end-to-end (data model through to user interface)
- Create list views with data-table components (search, sort, filter, pagination)
- Build forms that map table fields to appropriate input types
- Connect form actions to the records API (create, update, delete)
- Set up authenticated workflows (sign in/out, protected pages)
- Design navigation between list, detail, create, and edit views

## Installation

### Option 1: CLI Install (Recommended)

```bash
sovrium agents install website-editor
sovrium agents install api-editor
sovrium agents install crud-editor
```

This copies the agent template into your project's `.claude/agents/` directory.

### Option 2: Manual Copy

Copy the desired agent file from the Sovrium package into your project:

```bash
# Find where Sovrium is installed
SOVRIUM_PATH=$(bun pm ls | grep sovrium | head -1)

# Copy agent templates
mkdir -p .claude/agents
cp node_modules/sovrium/agents/website-editor.md .claude/agents/
cp node_modules/sovrium/agents/api-editor.md .claude/agents/
cp node_modules/sovrium/agents/crud-editor.md .claude/agents/
```

### Option 3: Download from Repository

```bash
mkdir -p .claude/agents

# Download individual agents
curl -o .claude/agents/website-editor.md \
  https://raw.githubusercontent.com/sovrium/sovrium/main/agents/website-editor.md

curl -o .claude/agents/api-editor.md \
  https://raw.githubusercontent.com/sovrium/sovrium/main/agents/api-editor.md

curl -o .claude/agents/crud-editor.md \
  https://raw.githubusercontent.com/sovrium/sovrium/main/agents/crud-editor.md
```

## Customizing Agents

After installation, agents live in your project's `.claude/agents/` directory and can be freely modified.

Common customizations:

### Add Project-Specific Context

Add your project's conventions, naming patterns, or design system details to the agent's Key Knowledge section:

```markdown
### Project Conventions

- All table names use singular form (e.g., `product` not `products`)
- Color palette follows our brand guide: primary=#1a73e8, secondary=#...
- Translation keys use the format: `page.section.element`
```

### Restrict Scope

If you only use certain features, remove irrelevant sections to keep the agent focused:

```markdown
## Key Knowledge

### Pages Configuration

(keep only the section types you actually use)
```

### Add Custom Workflows

Extend the Workflow section with your team's development process:

```markdown
## Workflow

... 7. **Code review**: Create a PR with the config changes 8. **Deploy**: Push to staging for QA review
```

### Combine Agents

For smaller projects, you can merge agents into a single file that covers everything:

```bash
# Create a combined agent
cat .claude/agents/website-editor.md .claude/agents/api-editor.md > .claude/agents/sovrium-editor.md
# Then edit the frontmatter and remove duplicate sections
```

## Agent Format

Agents use the Claude Code agent markdown format with YAML frontmatter:

```markdown
---
name: agent-name
description: |-
  One-paragraph description of when to use this agent.
---

# Agent Title

System instructions for the agent.

## Key Knowledge

What the agent knows about Sovrium configuration.

## Workflow

Step-by-step process the agent follows.

## Available Commands

CLI commands the agent uses.
```

See the [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code) for the full agent specification.
