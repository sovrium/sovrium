# Contributing to Sovrium

Thank you for your interest in contributing to Sovrium! We welcome contributions from the community while maintaining a sustainable business model through our fair-code licensing approach.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How Development Works](#how-development-works)
- [Development Workflow](#development-workflow)
- [Commit Guidelines](#commit-guidelines)
- [Contributor License Agreement (CLA)](#contributor-license-agreement-cla)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

By participating in this project, you agree to maintain a respectful, inclusive, and collaborative environment. We expect all contributors to:

- Be respectful and constructive in communication
- Welcome newcomers and help them get started
- Accept constructive criticism gracefully
- Focus on what's best for the project and community

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.3.10 or higher
- [PostgreSQL](https://www.postgresql.org/) 15 or higher
- Git
- A GitHub account

### Setting Up Your Development Environment

1. **Fork the repository** on GitHub
2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR-USERNAME/sovrium.git
   cd sovrium
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/sovrium/sovrium.git
   ```
4. **Install dependencies**:
   ```bash
   bun install
   ```
5. **Verify your setup**:
   ```bash
   bun run quality --skip-e2e --skip-coverage
   ```

## How Development Works

Sovrium uses **spec-driven development**. Instead of writing application code directly, contributors define _what_ the system should do through specifications. A TDD automation pipeline then handles the implementation.

### What Contributors Write

| Artifact           | Location                 | Purpose                                        |
| ------------------ | ------------------------ | ---------------------------------------------- |
| **User Stories**   | `docs/user-stories/`     | Feature requirements in structured markdown    |
| **Domain Schemas** | `src/domain/models/app/` | Effect Schemas defining data structures        |
| **API Schemas**    | `src/domain/models/api/` | Zod schemas for OpenAPI contracts              |
| **E2E Test Specs** | `specs/`                 | Playwright tests that define expected behavior |

### The TDD Pipeline

When E2E test specs contain `.fixme()` markers, the TDD automation pipeline picks them up:

1. **PR Creator** scans `specs/` for `.fixme()` tests and opens a TDD pull request
2. **Claude Code** implements the minimum code needed to make the tests pass
3. **CI validates** the implementation against the full quality pipeline
4. **Auto-merge** happens when all tests are GREEN

Contributors focus on writing precise, well-structured specs. The pipeline turns them into working code.

### Source of Truth Hierarchy

User Stories → Domain Schemas → API Schemas → E2E Tests → Implementation

Each layer constrains the next. A well-written user story leads to a clear schema, which leads to a focused test, which leads to correct code.

### Direct Code Contributions

Traditional code contributions (bug fixes, refactoring, performance improvements) are still welcome via standard pull requests. The spec-driven workflow applies primarily to new features.

### Using Claude Code for Specification Work

We recommend using [Claude Code](https://docs.anthropic.com/en/docs/claude-code) with the **product-specs-architect** agent to write specification artifacts. This agent is purpose-built to guide you through the full spec workflow:

1. **Competitive research** — Researches how platforms like Airtable, Retool, and Notion implement similar features
2. **User story authoring** — Creates structured user stories in `docs/user-stories/` with acceptance criteria
3. **Schema design** — Generates Effect Schemas (`src/domain/models/app/`) and Zod API schemas (`src/domain/models/api/`)
4. **E2E test creation** — Writes Playwright test specs with `.fixme()` markers, realistic test data, and GIVEN-WHEN-THEN structure
5. **Quality validation** — Runs `bun run quality --skip-e2e` and `bun run progress` to ensure everything passes

#### How to Use It

From the project root, invoke the agent in Claude Code:

```
@.claude/agents/product-specs-architect.md Design the specification for [your feature]
```

Or simply describe what you want to build — Claude Code will route to the agent automatically when the task involves specification work.

#### What the Agent Produces

| Artifact       | Output                                                   | Ready for      |
| -------------- | -------------------------------------------------------- | -------------- |
| User stories   | `docs/user-stories/as-developer/{category}/{feature}.md` | Review & merge |
| Domain schemas | `src/domain/models/app/{feature}.ts`                     | Review & merge |
| API schemas    | `src/domain/models/api/{feature}.ts`                     | Review & merge |
| E2E test specs | `specs/app/{feature}.spec.ts` with `.fixme()` markers    | TDD pipeline   |

After your spec PR is merged, the TDD automation pipeline picks up the `.fixme()` tests and generates the implementation automatically.

## Development Workflow

### Branch Naming

```bash
git checkout -b feat/your-feature-name   # New feature specs
git checkout -b fix/your-bug-fix         # Bug fixes
git checkout -b docs/your-doc-change     # Documentation
```

### Writing Specifications

1. **Start with a user story** in `docs/user-stories/` describing the feature from the user's perspective
2. **Design domain schemas** in `src/domain/models/app/` using Effect Schema
3. **Define API contracts** in `src/domain/models/api/` using Zod (for OpenAPI compatibility)
4. **Write E2E test specs** in `specs/` using Playwright — mark tests with `.fixme()` to signal they need implementation

### Coding Standards

See [CLAUDE.md](CLAUDE.md) for detailed guidelines:

- No semicolons (Prettier enforced)
- Single quotes, 100 character line width
- TypeScript strict mode
- Functional programming patterns (ESLint enforced)

### Running Quality Checks

Before committing, run the quality pipeline:

```bash
bun run quality              # Full pipeline (format, lint, types, tests, E2E)
bun run quality --skip-e2e   # Skip E2E tests (faster for spec-only changes)
bun run progress             # Validate specs and user stories
```

The `quality` command runs Prettier, ESLint, TypeScript, unit tests, Knip, and E2E tests in sequence. No need to run them individually.

## Commit Guidelines

We use **[Conventional Commits](https://www.conventionalcommits.org/)** for automated versioning and changelog generation.

### Commit Message Format

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

### Commit Types

| Type       | Description                                       | Version Bump  |
| ---------- | ------------------------------------------------- | ------------- |
| `feat`     | New feature                                       | Minor (0.X.0) |
| `fix`      | Bug fix                                           | Patch (0.0.X) |
| `docs`     | Documentation only changes                        | None          |
| `style`    | Code style changes (formatting, semicolons, etc.) | None          |
| `refactor` | Code refactoring without behavior change          | None          |
| `perf`     | Performance improvements                          | Patch (0.0.X) |
| `test`     | Adding or updating tests                          | None          |
| `chore`    | Build process or auxiliary tool changes           | None          |
| `ci`       | CI configuration changes                          | None          |

### Examples

```bash
# Feature spec (minor version bump)
git commit -m "feat(tables): add multi-select field spec and E2E tests"

# Bug fix (patch version bump)
git commit -m "fix(auth): resolve session expiration bug"

# Documentation (no version bump)
git commit -m "docs(readme): update installation instructions"

# Breaking change (major version bump)
git commit -m "feat!: redesign configuration schema API

BREAKING CHANGE: The configuration schema API has been redesigned.
Existing configurations need to be migrated using the provided script."
```

## Contributor License Agreement (CLA)

**Important**: By submitting a contribution to Sovrium, you agree to the following terms:

### Grant of Rights

You grant **ESSENTIAL SERVICES** and recipients of software distributed by ESSENTIAL SERVICES:

1. **Copyright License**: A perpetual, worldwide, non-exclusive, royalty-free, irrevocable copyright license to:
   - Use, reproduce, prepare derivative works of, publicly display, publicly perform, sublicense, and distribute your contributions and such derivative works

2. **Patent License**: A perpetual, worldwide, non-exclusive, royalty-free, irrevocable patent license to:
   - Make, have made, use, offer to sell, sell, import, and otherwise transfer your contributions

3. **Dual Licensing Rights**: The right to license your contributions under:
   - The Business Source License 1.1 (current license)
   - Commercial licenses to third parties
   - Any other license deemed appropriate by ESSENTIAL SERVICES

### Your Representations

By contributing, you certify that:

- You have the right to grant the above licenses
- Your contribution is your original creation or you have rights to submit it
- Your contribution does not violate any third-party rights
- You are aware that Sovrium is fair-code licensed and may be commercially licensed
- You understand that ESSENTIAL SERVICES may earn revenue from commercial licenses

### Why We Need a CLA

The CLA allows us to:

- Maintain a sustainable business through dual licensing
- Offer commercial licenses without legal complications
- Protect the project from legal challenges
- Ensure long-term viability of the project

**By submitting a pull request, you automatically agree to this CLA.**

## Pull Request Process

### Before Submitting

1. Run the quality pipeline: `bun run quality`
2. Follow commit message conventions
3. Rebase on latest `main` branch

### Submitting Your PR

1. **Push to your fork**:

   ```bash
   git push origin feat/your-feature-name
   ```

2. **Create Pull Request** on GitHub with:
   - Clear title following conventional commits format
   - Description of what the specs define and why
   - Link to related issues (if applicable)

3. **For spec PRs with `.fixme()` tests**: After your PR is merged to `main`, the TDD pipeline will automatically detect the `.fixme()` markers and create a separate implementation PR.

### Review Process

1. **Automated Checks**: GitHub Actions runs the full quality pipeline
2. **Code Review**: Maintainers review your specs and schemas
3. **Feedback**: Address any requested changes
4. **Approval**: Once approved, a maintainer will merge your PR

### After Merging

- Spec PRs with `.fixme()` tests trigger the TDD pipeline for automated implementation
- Your contribution will be included in the next release
- You'll be credited in the release notes and contributors list
- Commercial licenses may include your code (per the CLA)

## Questions?

- **General Questions**: Open a [GitHub Discussion](https://github.com/sovrium/sovrium/discussions)
- **Bug Reports**: Open a [GitHub Issue](https://github.com/sovrium/sovrium/issues)
- **Commercial Licensing**: Contact license@sovrium.com
- **Documentation**: See [CLAUDE.md](CLAUDE.md) for technical details

---

**Thank you for contributing to Sovrium!**

Your contributions help build a sustainable, community-driven project that balances open collaboration with commercial viability.

**Copyright**: © 2025-2026 ESSENTIAL SERVICES
**License**: Business Source License 1.1 (BSL 1.1)
