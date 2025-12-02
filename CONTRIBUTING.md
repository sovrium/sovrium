# Contributing to Sovrium

Thank you for your interest in contributing to Sovrium! We welcome contributions from the community while maintaining a sustainable business model through our fair-code licensing approach.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
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

- [Bun](https://bun.sh) v1.3.3 or higher
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
   bun run lint && bun run typecheck && bun test:unit
   ```

## Development Workflow

### Creating a Feature Branch

```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### Making Changes

1. **Follow coding standards** - See [CLAUDE.md](CLAUDE.md) for detailed guidelines:
   - No semicolons (Prettier enforced)
   - Single quotes
   - 100 character line width
   - TypeScript strict mode
   - Functional programming patterns (ESLint enforced)

2. **Write tests**:
   - Unit tests: Co-located with source files (`*.test.ts`)
   - E2E tests: In `tests/` directory (`*.spec.ts`)
   - Aim for high coverage of new code

3. **Keep commits focused** - One logical change per commit

### Running Quality Checks

Before committing, always run:

```bash
# Run all checks
bun run lint && bun run format && bun run typecheck && bun test:unit

# Or individually
bun run lint          # ESLint
bun run format        # Prettier formatting
bun run typecheck     # TypeScript type checking
bun test:unit         # Unit tests
bun test:e2e          # E2E tests
```

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
# Feature (minor version bump)
git commit -m "feat(tables): add multi-select field support"

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

- ✅ You have the right to grant the above licenses
- ✅ Your contribution is your original creation or you have rights to submit it
- ✅ Your contribution does not violate any third-party rights
- ✅ You are aware that Sovrium is fair-code licensed and may be commercially licensed
- ✅ You understand that ESSENTIAL SERVICES may earn revenue from commercial licenses

### Why We Need a CLA

The CLA allows us to:

- Maintain a sustainable business through dual licensing
- Offer commercial licenses without legal complications
- Protect the project from legal challenges
- Ensure long-term viability of the project

**By submitting a pull request, you automatically agree to this CLA.**

## Pull Request Process

### Before Submitting

1. ✅ Ensure all tests pass (`bun test:all`)
2. ✅ Run code quality checks (`bun run lint && bun run format && bun run typecheck`)
3. ✅ Update documentation if needed
4. ✅ Add tests for new features
5. ✅ Follow commit message conventions
6. ✅ Rebase on latest `main` branch

### Submitting Your PR

1. **Push to your fork**:

   ```bash
   git push origin feat/your-feature-name
   ```

2. **Create Pull Request** on GitHub with:
   - Clear title following conventional commits format
   - Description of changes and motivation
   - Link to related issues (if applicable)
   - Screenshots/examples for UI changes

3. **PR Template** (fill this in):

   ```markdown
   ## Description

   [Describe what this PR does]

   ## Motivation

   [Why is this change needed?]

   ## Type of Change

   - [ ] Bug fix (non-breaking change which fixes an issue)
   - [ ] New feature (non-breaking change which adds functionality)
   - [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
   - [ ] Documentation update

   ## How Has This Been Tested?

   - [ ] Unit tests
   - [ ] E2E tests
   - [ ] Manual testing

   ## Checklist

   - [ ] My code follows the project's style guidelines
   - [ ] I have performed a self-review of my code
   - [ ] I have commented my code where necessary
   - [ ] I have updated the documentation accordingly
   - [ ] My changes generate no new warnings
   - [ ] I have added tests that prove my fix is effective or that my feature works
   - [ ] New and existing unit tests pass locally with my changes
   - [ ] I agree to the Contributor License Agreement (CLA)
   ```

### Review Process

1. **Automated Checks**: GitHub Actions will run tests and quality checks
2. **Code Review**: Maintainers will review your code
3. **Feedback**: Address any requested changes
4. **Approval**: Once approved, a maintainer will merge your PR

### After Merging

- Your contribution will be included in the next release
- You'll be credited in the release notes and contributors list
- Commercial licenses may include your code (per the CLA)

## Questions?

- **General Questions**: Open a [GitHub Discussion](https://github.com/sovrium/sovrium/discussions)
- **Bug Reports**: Open a [GitHub Issue](https://github.com/sovrium/sovrium/issues)
- **Commercial Licensing**: Contact license@sovrium.com
- **Documentation**: See [CLAUDE.md](CLAUDE.md) for technical details

---

**Thank you for contributing to Sovrium!** 🎉

Your contributions help build a sustainable, community-driven project that balances open collaboration with commercial viability.

**Copyright**: © 2025 ESSENTIAL SERVICES
**License**: Business Source License 1.1 (BSL 1.1)
