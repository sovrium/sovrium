# Page Blocks

> **Feature Area**: Pages - Reusable Blocks
> **Schema**: `src/domain/models/app/blocks/`
> **E2E Specs**: `specs/app/blocks/`

---

## Overview

Blocks in Sovrium are reusable content components that can be included in page sections. They support variable substitution for dynamic content, allowing a single block definition to be customized per usage. Blocks also include specialized components like language switchers for internationalization.

---

## US-BLOCKS-001: Define Reusable Blocks

**As a** developer,
**I want to** define reusable content blocks,
**so that** I can share common components across multiple pages.

### Configuration

```yaml
blocks:
  - id: 1
    name: cta-banner
    type: banner
    content:
      title: '{{title}}'
      description: '{{description}}'
      button:
        text: '{{buttonText}}'
        link: '{{buttonLink}}'

pages:
  - id: 1
    name: home
    path: /
    sections:
      - block: cta-banner
        variables:
          title: Get Started Today
          description: Join thousands of users
          buttonText: Sign Up
          buttonLink: /signup
```

### Acceptance Criteria

| ID     | Criterion                                        | E2E Spec         |
| ------ | ------------------------------------------------ | ---------------- |
| AC-001 | Blocks array defines reusable components         | `APP-BLOCKS-001` |
| AC-002 | Block id must be unique                          | `APP-BLOCKS-002` |
| AC-003 | Block name must be unique                        | `APP-BLOCKS-003` |
| AC-004 | Block type determines rendering component        | `APP-BLOCKS-004` |
| AC-005 | Block content supports template syntax           | `APP-BLOCKS-005` |
| AC-006 | Missing block reference returns validation error | `APP-BLOCKS-006` |
| AC-007 | Empty blocks array is valid                      | `APP-BLOCKS-007` |
| AC-008 | Block can be referenced by name in sections      | `APP-BLOCKS-008` |
| AC-009 | Block can be referenced by id in sections        | `APP-BLOCKS-009` |

### Implementation References

- **Schema**: `src/domain/models/app/blocks/block.ts`
- **E2E Spec**: `specs/app/blocks/blocks.spec.ts`

---

## US-BLOCKS-002: Variable Substitution

**As a** developer,
**I want to** use variable placeholders in blocks,
**so that** I can customize block content at each usage point.

### Configuration

```yaml
blocks:
  - id: 1
    name: feature-card
    type: card
    content:
      icon: '{{icon}}'
      title: '{{title}}'
      description: '{{description}}'
      link: "{{link | default: '#'}}" # With default value

pages:
  - id: 1
    name: features
    path: /features
    sections:
      - block: feature-card
        variables:
          icon: rocket
          title: Fast Performance
          description: Lightning fast builds
          # link uses default value '#'
```

### Acceptance Criteria

| ID     | Criterion                                        | E2E Spec         |
| ------ | ------------------------------------------------ | ---------------- |
| AC-001 | Variables use {{variableName}} syntax            | `APP-BLOCKS-010` |
| AC-002 | Variables are replaced with provided values      | `APP-BLOCKS-011` |
| AC-003 | Missing variable without default returns error   | `APP-BLOCKS-012` |
| AC-004 | Variables support default values via pipe syntax | `APP-BLOCKS-013` |
| AC-005 | Variables support nested object access           | `APP-BLOCKS-014` |
| AC-006 | Variables are type-safe when schema defined      | `APP-BLOCKS-015` |
| AC-007 | Empty variable value renders empty string        | `APP-BLOCKS-016` |
| AC-008 | Variables support array iteration                | `APP-BLOCKS-017` |
| AC-009 | Variables support conditional rendering          | `APP-BLOCKS-018` |

### Implementation References

- **Schema**: `src/domain/models/app/blocks/block-variables.ts`
- **E2E Spec**: `specs/app/blocks/blocks.spec.ts`

---

## US-BLOCKS-003: Language Switcher Block

**As a** developer,
**I want to** include a language switcher component,
**so that** users can change the application language.

### Configuration

```yaml
languages:
  - code: en
    name: English
    default: true
  - code: fr
    name: Français
  - code: es
    name: Español

blocks:
  - id: 100
    name: lang-switcher
    type: language-switcher
    content:
      style: dropdown # dropdown | flags | list
      showNames: true
      showFlags: true

pages:
  - id: 1
    name: home
    path: /
    sections:
      - block: lang-switcher
```

### Acceptance Criteria

| ID     | Criterion                                               | E2E Spec                           |
| ------ | ------------------------------------------------------- | ---------------------------------- |
| AC-001 | Language switcher displays available languages          | `APP-BLOCKS-LANGUAGE-SWITCHER-001` |
| AC-002 | Language switcher changes current language on selection | `APP-BLOCKS-LANGUAGE-SWITCHER-002` |
| AC-003 | Language switcher highlights current language           | `APP-BLOCKS-LANGUAGE-SWITCHER-003` |

### Implementation References

- **Schema**: `src/domain/models/app/blocks/language-switcher.ts`
- **E2E Spec**: `specs/app/blocks/language-switcher.spec.ts`

---

## Regression Tests

| Spec ID                                   | Workflow                                         | Status |
| ----------------------------------------- | ------------------------------------------------ | ------ |
| `APP-BLOCKS-REGRESSION`                   | Developer creates reusable blocks with variables | `[x]`  |
| `APP-BLOCKS-LANGUAGE-SWITCHER-REGRESSION` | Language switcher works with i18n configuration  | `[x]`  |

---

## Coverage Summary

| User Story    | Title                   | Spec Count            | Status   |
| ------------- | ----------------------- | --------------------- | -------- |
| US-BLOCKS-001 | Define Reusable Blocks  | 9                     | Complete |
| US-BLOCKS-002 | Variable Substitution   | 9                     | Complete |
| US-BLOCKS-003 | Language Switcher Block | 3                     | Complete |
| **Total**     |                         | **21 + 2 regression** |          |
