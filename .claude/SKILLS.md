# Claude Code Skills Reference

## Overview

Skills are autonomous, reusable utilities that Claude automatically invokes when appropriate. Unlike agents (which require explicit invocation or user collaboration), skills are **model-invoked**—Claude decides when to use them based on your request and the skill's description.

**Location**: `.claude/skills/`

**Total Skills**: 9

---

## Skill Categories

### Translation Skills (Mechanical)

#### 1. e2e-test-generator
- **Purpose**: Mechanically translates validated specs arrays from .schema.json files into co-located Playwright test files
- **Trigger**: "translate specs to tests", "generate Playwright tests from schema", "convert specs arrays"
- **Input**: Validated specs arrays in JSON Schema files
- **Output**: Playwright test files (specs/{property}.spec.ts) with test.fixme() markers
- **Location**: `.claude/skills/e2e-test-generator/SKILL.md`
- **Characteristics**:
  - Deterministic translation (same input → same output)
  - Refuses if specs array missing or invalid
  - Creates multiple @spec tests + ONE @regression test
  - Uses allowed-tools: Read, Write, Bash

**Example Usage**:
```
User: "Translate specs to Playwright tests for the name property"
Claude: [Automatically invokes e2e-test-generator skill]
```

#### 2. effect-schema-generator
- **Purpose**: Mechanically translates validated JSON Schema definitions into Effect Schema TypeScript implementations
- **Trigger**: "translate schema to Effect", "convert JSON Schema to Effect Schema", "generate Effect Schema"
- **Input**: Validated JSON Schema from specs.schema.json
- **Output**: Effect Schema implementations (src/domain/models/app/{property}.ts) with unit tests
- **Location**: `.claude/skills/effect-schema-generator/SKILL.md`
- **Characteristics**:
  - Deterministic translation following established patterns
  - Refuses if Triple-Documentation Pattern incomplete
  - Creates TypeScript + test files
  - Uses allowed-tools: Read, Write, Edit, Bash

**Example Usage**:
```
User: "Translate the tables property schema to Effect"
Claude: [Automatically invokes effect-schema-generator skill]
```

---

### Validation Skills

#### 3. config-validator
- **Purpose**: Validates eslint.config.ts and tsconfig.json against documented architecture patterns
- **Trigger**: "validate config", "check eslint", "verify typescript settings", "config audits"
- **Input**: eslint.config.ts, tsconfig.json, package.json, docs/architecture/, docs/infrastructure/
- **Output**: Configuration validation report with compliance status
- **Location**: `.claude/skills/config-validator/SKILL.md`
- **Checks**:
  - FP enforcement (eslint-plugin-functional)
  - Layer boundaries (eslint-plugin-boundaries)
  - TypeScript strict mode flags
  - Path alias configurations
  - Dependency versions
- **Uses allowed-tools**: Read, Bash, Grep

**Example Usage**:
```
User: "Validate my ESLint and TypeScript configs"
Claude: [Automatically invokes config-validator skill]
```

#### 4. json-schema-validator
- **Purpose**: Validates JSON Schema (Draft 7) and OpenAPI 3.1.0 files for structure compliance
- **Trigger**: "validate schema", "check JSON Schema", "verify specs", "schema compliance checks"
- **Input**: .schema.json, .openapi.json files
- **Output**: Schema validation report with errors and warnings
- **Location**: `.claude/skills/json-schema-validator/SKILL.md`
- **Checks**:
  - Schema metadata completeness
  - Triple-Documentation Pattern
  - Specs array structure and spec ID format (PREFIX-ENTITY-NNN)
  - $ref resolution
  - Property constraints validity
- **Uses allowed-tools**: Read, Bash, Grep

**Example Usage**:
```
User: "Validate the name property schema"
Claude: [Automatically invokes json-schema-validator skill]
```

---

### Security & Code Quality Skills

#### 5. security-scanner
- **Purpose**: Scans codebase for common security vulnerabilities (OWASP Top 10)
- **Trigger**: "security scan", "check vulnerabilities", "audit security", "security review"
- **Input**: src/, scripts/ source files
- **Output**: Security scan report with severity levels (CRITICAL, HIGH, MEDIUM, LOW, INFO)
- **Location**: `.claude/skills/security-scanner/SKILL.md`
- **Detects**:
  - SQL injection, XSS, command injection risks
  - Hardcoded secrets and credentials
  - Authentication and authorization gaps
  - Data exposure vulnerabilities
  - Insecure configurations
  - Dependency vulnerabilities
- **Uses allowed-tools**: Read, Grep, Glob, Bash

**Example Usage**:
```
User: "Run a security scan on the codebase"
Claude: [Automatically invokes security-scanner skill]
```

#### 6. code-duplication-detector
- **Purpose**: Detects duplicate code patterns and DRY violations across the codebase
- **Trigger**: "find duplicates", "check for copy-paste code", "detect repeated logic", "DRY violations"
- **Input**: src/ source files
- **Output**: Duplication report with similarity scores and refactoring suggestions
- **Location**: `.claude/skills/code-duplication-detector/SKILL.md`
- **Detects**:
  - Exact duplicates (100% match)
  - Near-exact duplicates (90-99% match)
  - Structural duplicates (70-89% match)
  - Pattern duplicates (50-69% match)
- **Uses allowed-tools**: Read, Grep, Glob

**Example Usage**:
```
User: "Find duplicate code in the project"
Claude: [Automatically invokes code-duplication-detector skill]
```

#### 7. dependency-tracker
- **Purpose**: Tracks package.json dependencies and identifies undocumented or misaligned tools
- **Trigger**: "check dependencies", "audit package.json", "find undocumented packages", "dependency alignment"
- **Input**: package.json, docs/infrastructure/
- **Output**: Dependency tracking report with version mismatches and documentation gaps
- **Location**: `.claude/skills/dependency-tracker/SKILL.md`
- **Tracks**:
  - Version mismatches (installed vs. documented)
  - Undocumented dependencies
  - Outdated packages
  - Unused dependencies
  - Security vulnerabilities
- **Uses allowed-tools**: Read, Bash, Grep, Glob

**Example Usage**:
```
User: "Check if all dependencies are documented"
Claude: [Automatically invokes dependency-tracker skill]
```

#### 8. best-practices-checker
- **Purpose**: Validates code against framework-specific best practices documented in docs/infrastructure/
- **Trigger**: "check best practices", "validate framework usage", "review code patterns", "framework compliance"
- **Input**: src/ source files, docs/infrastructure/
- **Output**: Best practices report with violations and corrections
- **Location**: `.claude/skills/best-practices-checker/SKILL.md`
- **Validates**:
  - Effect usage patterns (Effect.gen, Layer, typed errors)
  - React 19 conventions (Server Components, no manual memoization)
  - Drizzle ORM patterns (type-safe queries, schema definition)
  - Hono RPC implementations (Zod validation, type safety)
  - TanStack Query conventions (query keys, mutations)
  - React Hook Form patterns (Zod resolvers)
- **Uses allowed-tools**: Read, Grep, Glob

**Example Usage**:
```
User: "Check if my Effect code follows best practices"
Claude: [Automatically invokes best-practices-checker skill]
```

---

## Skills vs. Agents

### When Claude Uses Skills

Claude **automatically** invokes skills when:
- User requests deterministic translation ("translate specs to tests")
- User requests validation or compliance checks ("validate configs")
- User requests code analysis ("find duplicates", "check security")
- Task matches skill description and is autonomous (no user collaboration needed)

### When Claude Uses Agents

Claude requires **explicit invocation** or enters **collaborative mode** for:
- Design decisions requiring user input (json-schema-editor)
- Implementation choices with multiple approaches (e2e-test-fixer)
- Strategic planning and prioritization (codebase-refactor-auditor)
- Documentation requiring architectural context (architecture-docs-maintainer)

### Key Differences

| Aspect | Skills | Agents |
|--------|--------|--------|
| **Invocation** | Autonomous (Claude decides) | Explicit (@ syntax or collaboration) |
| **User Interaction** | None (fail-fast if input invalid) | Collaborative (asks questions) |
| **Decision Making** | Zero (follows patterns exactly) | Creative (makes choices with user) |
| **Token Efficiency** | High (minimal context) | Lower (full agent context) |
| **Use Case** | Deterministic utilities | Strategic workflows |

---

## Skill Development Guidelines

(Based on https://docs.claude.com/en/docs/claude-code/skills)

### Creating a New Skill

1. **Create directory**: `.claude/skills/{skill-name}/`
2. **Create SKILL.md** with frontmatter:
   ```yaml
   ---
   name: skill-name
   description: |
     Clear, specific description with trigger terms users would mention.
     Max 1024 characters.
   allowed-tools: [Read, Write, Grep, Glob, Bash]
   ---
   ```
3. **Write focused instructions**: One skill = one capability
4. **Test activation**: Verify skill triggers when expected

### Best Practices

- **Keep Skills Focused**: One specific capability per skill
- **Write Specific Descriptions**: Include concrete trigger terms and use cases
- **Restrict Tool Access**: Only include tools the skill actually needs
- **Fail Fast**: Refuse clearly when input is invalid or incomplete
- **No Decision Making**: Skills follow patterns, never make design choices

### Common Anti-Patterns

❌ **Don't**: Create skills that require user collaboration
❌ **Don't**: Make skills that need to ask clarifying questions
❌ **Don't**: Give skills broad, vague descriptions
❌ **Don't**: Duplicate agent functionality in skills
✅ **Do**: Create skills for repetitive, pattern-following tasks
✅ **Do**: Make skills refuse clearly when they can't proceed
✅ **Do**: Use skills to complement agents (utilities vs. collaboration)

---

## Troubleshooting

### Skill Not Activating

**Problem**: Claude doesn't use skill when expected

**Solutions**:
1. Make description more specific with concrete trigger terms
2. Include use case examples in description
3. Verify `name` matches user request patterns
4. Check if task actually requires user collaboration (use agent instead)

### Skill Failing

**Problem**: Skill refuses or errors frequently

**Solutions**:
1. Check input requirements are clear and validated
2. Add better error messages explaining what's missing
3. Verify allowed-tools includes everything skill needs
4. Review fail-fast protocol (refuse early with clear guidance)

### Skill vs. Agent Confusion

**Problem**: Unclear whether to create skill or agent

**Decision Tree**:
```
Does task require user questions or collaboration?
├─ YES → Create Agent
└─ NO → Does task follow deterministic patterns?
          ├─ YES → Create Skill
          └─ NO → Neither (use direct tools or existing agent)
```

---

## Integration with Agents

Skills complement agents in the TDD workflow:

```
TDD Pipeline:
1. json-schema-editor (AGENT - collaborative design)
2. effect-schema-generator (SKILL - mechanical translation) ← Autonomous
3. e2e-test-generator (SKILL - mechanical translation) ← Autonomous
4. e2e-test-fixer (AGENT - creative implementation)
5. codebase-refactor-auditor (AGENT - strategic refactoring)
   → Uses: security-scanner, code-duplication-detector, best-practices-checker
```

Utility skills support all agents:
- **config-validator** → Validates configs for architecture/infrastructure docs maintainers
- **json-schema-validator** → Validates schemas for json-schema-editor, openapi-editor
- **dependency-tracker** → Tracks packages for infrastructure-docs-maintainer
- **security-scanner** → Audits code for codebase-refactor-auditor
- **code-duplication-detector** → Identifies refactoring targets
- **best-practices-checker** → Validates framework patterns

---

## Quick Reference

### Translation Skills
- `e2e-test-generator` - specs → Playwright tests
- `effect-schema-generator` - JSON Schema → Effect Schema

### Validation Skills
- `config-validator` - ESLint/TypeScript config compliance
- `json-schema-validator` - JSON Schema/OpenAPI compliance

### Analysis Skills
- `security-scanner` - Security vulnerability detection
- `code-duplication-detector` - Duplicate code detection
- `dependency-tracker` - Dependency alignment tracking
- `best-practices-checker` - Framework pattern validation

---

**Last Updated**: 2025-01-15 (with conversion of e2e-test-translator and effect-schema-translator agents to skills)
