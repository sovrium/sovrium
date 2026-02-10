# Page Blocks

> **Feature Area**: Pages - Reusable Blocks
> **Schema**: `src/domain/models/app/block/`, `src/domain/models/app/blocks.ts`
> **E2E Specs**: `specs/app/blocks/`

---

## Overview

Blocks in Sovrium are reusable content components that can be included in page sections. They support variable substitution for dynamic content, allowing a single block definition to be customized per usage. Blocks also include specialized components like language switchers for internationalization.

---

## US-PAGES-BLOCKS-001: Define Reusable Blocks

**As a** developer,
**I want to** define reusable content blocks,
**so that** I can share common components across multiple pages.

### Configuration

```yaml
blocks:
  - name: cta-banner
    type: banner
    children:
      - type: heading
        content: '$title'
      - type: paragraph
        content: '$description'
      - type: button
        content: '$buttonText'
        props:
          href: '$buttonLink'

pages:
  - id: 1
    name: home
    path: /
    sections:
      - type: cta
        props:
          id: cta
          block: cta-banner
          variables:
            title: Get Started Today
            description: Join thousands of users
            buttonText: Sign Up
            buttonLink: /signup
```

### Acceptance Criteria

| ID     | Criterion                                           | E2E Spec                | Status |
| ------ | --------------------------------------------------- | ----------------------- | ------ |
| AC-001 | Blocks array defines reusable components            | `APP-BLOCKS-001`        | ✅     |
| AC-002 | Block id must be unique                             | `APP-BLOCKS-002`        | ✅     |
| AC-003 | Block name must be unique                           | `APP-BLOCKS-003`        | ✅     |
| AC-004 | Block type determines rendering component           | `APP-BLOCKS-004`        | ✅     |
| AC-005 | Block content supports template syntax              | `APP-BLOCKS-005`        | ✅     |
| AC-006 | Missing block reference returns validation error    | `APP-BLOCKS-006`        | ✅     |
| AC-007 | Empty blocks array is valid                         | `APP-BLOCKS-007`        | ✅     |
| AC-008 | Block can be referenced by name in sections         | `APP-BLOCKS-008`        | ✅     |
| AC-009 | Block can be referenced by id in sections           | `APP-BLOCKS-009`        | ✅     |
| AC-010 | User can complete full blocks workflow (regression) | `APP-BLOCKS-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/blocks/blocks.spec.ts`

---

## US-PAGES-BLOCKS-002: Variable Substitution

**As a** developer,
**I want to** use variable placeholders in blocks,
**so that** I can customize block content at each usage point.

### Configuration

```yaml
blocks:
  - name: feature-card
    type: card
    children:
      - type: icon
        content: '$icon'
      - type: heading
        content: '$title'
      - type: paragraph
        content: '$description'
      - type: link
        content: 'Learn more'
        props:
          href: "$link | default: '#'" # With default value

pages:
  - id: 1
    name: features
    path: /features
    sections:
      - type: custom
        props:
          id: feature
          block: feature-card
          variables:
            icon: rocket
            title: Fast Performance
            description: Lightning fast builds
            # link uses default value '#'
```

### Acceptance Criteria

| ID     | Criterion                                        | E2E Spec         | Status |
| ------ | ------------------------------------------------ | ---------------- | ------ |
| AC-001 | Variables use {{variableName}} syntax            | `APP-BLOCKS-010` | ✅     |
| AC-002 | Variables are replaced with provided values      | `APP-BLOCKS-011` | ✅     |
| AC-003 | Missing variable without default returns error   | `APP-BLOCKS-012` | ✅     |
| AC-004 | Variables support default values via pipe syntax | `APP-BLOCKS-013` | ✅     |
| AC-005 | Variables support nested object access           | `APP-BLOCKS-014` | ✅     |
| AC-006 | Variables are type-safe when schema defined      | `APP-BLOCKS-015` | ✅     |
| AC-007 | Empty variable value renders empty string        | `APP-BLOCKS-016` | ✅     |
| AC-008 | Variables support array iteration                | `APP-BLOCKS-017` | ✅     |
| AC-009 | Variables support conditional rendering          | `APP-BLOCKS-018` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/blocks/blocks.spec.ts`

---

## US-PAGES-BLOCKS-003: Language Switcher Block

**As a** developer,
**I want to** include a language switcher component,
**so that** users can change the application language.

### Configuration

```yaml
languages:
  default: en
  supported:
    - locale: en
      label: English
    - locale: fr
      label: Français
    - locale: es
      label: Español

blocks:
  - name: lang-switcher
    type: language-switcher
    props:
      style: dropdown # dropdown | flags | list
      showNames: true
      showFlags: true

pages:
  - id: 1
    name: home
    path: /
    sections:
      - type: custom
        props:
          id: lang
          block: lang-switcher
```

### Acceptance Criteria

| ID     | Criterion                                                      | E2E Spec                                  | Status |
| ------ | -------------------------------------------------------------- | ----------------------------------------- | ------ |
| AC-001 | Language switcher displays available languages                 | `APP-BLOCKS-LANGUAGE-SWITCHER-001`        | ✅     |
| AC-002 | Language switcher changes current language on selection        | `APP-BLOCKS-LANGUAGE-SWITCHER-002`        | ✅     |
| AC-003 | Language switcher highlights current language                  | `APP-BLOCKS-LANGUAGE-SWITCHER-003`        | ✅     |
| AC-004 | User can complete full language switcher workflow (regression) | `APP-BLOCKS-LANGUAGE-SWITCHER-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/blocks/language-switcher.spec.ts`

---

## US-PAGES-BLOCKS-004: Block Children

**As a** developer,
**I want to** nest child elements within blocks,
**so that** I can create complex hierarchical UI structures.

### Configuration

```yaml
blocks:
  - name: card-with-children
    type: section
    children:
      - type: heading
        content: '$title'
      - type: text
        content: '$description'
      - type: button
        content: '$buttonText'
        props:
          href: '$buttonLink'
```

### Acceptance Criteria

| ID     | Criterion                                             | E2E Spec                         | Status |
| ------ | ----------------------------------------------------- | -------------------------------- | ------ |
| AC-001 | Block renders nested child components                 | `APP-BLOCKS-CHILDREN-001`        | ✅     |
| AC-002 | Child elements maintain proper hierarchy              | `APP-BLOCKS-CHILDREN-002`        | ✅     |
| AC-003 | Child with variables inherits parent context          | `APP-BLOCKS-CHILDREN-003`        | ✅     |
| AC-004 | Unlimited nesting depth is supported                  | `APP-BLOCKS-CHILDREN-004`        | ✅     |
| AC-005 | Child with conditional visibility works               | `APP-BLOCKS-CHILDREN-005`        | ✅     |
| AC-006 | Composite children from multiple sources render       | `APP-BLOCKS-CHILDREN-006`        | ✅     |
| AC-007 | SVG icons render within children                      | `APP-BLOCKS-CHILDREN-007`        | ✅     |
| AC-008 | Text elements render correctly in children            | `APP-BLOCKS-CHILDREN-008`        | ✅     |
| AC-009 | All child types render in single block                | `APP-BLOCKS-CHILDREN-009`        | ✅     |
| AC-010 | Hierarchical structure preserves across renders       | `APP-BLOCKS-CHILDREN-010`        | ✅     |
| AC-011 | User can complete full children workflow (regression) | `APP-BLOCKS-CHILDREN-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/blocks/common/block-children.spec.ts`

---

## US-PAGES-BLOCKS-005: Block Properties (Props)

**As a** developer,
**I want to** define properties on blocks,
**so that** I can pass configuration values and control rendering behavior.

### Configuration

```yaml
blocks:
  - name: styled-card
    type: card
    props:
      className: featured-card
      data-testid: card-1
      aria-label: Featured content
      disabled: false
      style:
        backgroundColor: '#f5f5f5'
```

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec                      | Status |
| ------ | -------------------------------------------------- | ----------------------------- | ------ |
| AC-001 | Props validates any valid prop name                | `APP-BLOCKS-PROPS-001`        | ✅     |
| AC-002 | Props render as HTML attributes                    | `APP-BLOCKS-PROPS-002`        | ✅     |
| AC-003 | String values render correctly                     | `APP-BLOCKS-PROPS-003`        | ✅     |
| AC-004 | Numeric values render correctly                    | `APP-BLOCKS-PROPS-004`        | ✅     |
| AC-005 | Boolean renders as data attribute                  | `APP-BLOCKS-PROPS-005`        | ✅     |
| AC-006 | Object renders as JSON data attribute              | `APP-BLOCKS-PROPS-006`        | ✅     |
| AC-007 | Array renders as JSON data attribute               | `APP-BLOCKS-PROPS-007`        | ✅     |
| AC-008 | All value types render correctly                   | `APP-BLOCKS-PROPS-008`        | ✅     |
| AC-009 | Combined style and class props work together       | `APP-BLOCKS-PROPS-009`        | ✅     |
| AC-010 | Complete component renders with all props          | `APP-BLOCKS-PROPS-010`        | ✅     |
| AC-011 | Props resolve translation keys                     | `APP-BLOCKS-PROPS-011`        | ✅     |
| AC-012 | Props resolve nested translation keys              | `APP-BLOCKS-PROPS-012`        | ✅     |
| AC-013 | Props resolve translation with fallback            | `APP-BLOCKS-PROPS-013`        | ✅     |
| AC-014 | Props work with both translations and variables    | `APP-BLOCKS-PROPS-014`        | ✅     |
| AC-015 | User can complete full props workflow (regression) | `APP-BLOCKS-PROPS-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/blocks/common/block-props.spec.ts`

---

## US-PAGES-BLOCKS-006: Block References

**As a** developer,
**I want to** reference blocks by name or ID,
**so that** I can reuse block definitions across pages and sections.

### Configuration

```yaml
blocks:
  - name: hero-section
    type: hero
    children:
      - type: heading
        content: '$title'

pages:
  - id: 1
    name: home
    path: /
    sections:
      - type: custom
        props:
          id: hero-1
          block: hero-section # Reference by name
          variables:
            title: Welcome Home
      - type: custom
        props:
          id: hero-2
          block: hero-section # Reference by name
          variables:
            title: Welcome Again
```

### Acceptance Criteria

| ID     | Criterion                                              | E2E Spec                          | Status |
| ------ | ------------------------------------------------------ | --------------------------------- | ------ |
| AC-001 | Block reference validates minimal structure            | `APP-BLOCKS-REFERENCE-001`        | ✅     |
| AC-002 | Block lookup includes referenced definition            | `APP-BLOCKS-REFERENCE-002`        | ✅     |
| AC-003 | Block name validates kebab-case format                 | `APP-BLOCKS-REFERENCE-003`        | ✅     |
| AC-004 | Invalid reference fails validation                     | `APP-BLOCKS-REFERENCE-004`        | ✅     |
| AC-005 | Reference provides all data for rendering              | `APP-BLOCKS-REFERENCE-005`        | ✅     |
| AC-006 | Reference validates JavaScript-safe identifiers        | `APP-BLOCKS-REFERENCE-006`        | ✅     |
| AC-007 | Reference substitutes primitive variables              | `APP-BLOCKS-REFERENCE-007`        | ✅     |
| AC-008 | Reference renders badge with variables                 | `APP-BLOCKS-REFERENCE-008`        | ✅     |
| AC-009 | Reference renders section with nested content          | `APP-BLOCKS-REFERENCE-009`        | ✅     |
| AC-010 | Reference transforms abstract to HTML elements         | `APP-BLOCKS-REFERENCE-010`        | ✅     |
| AC-011 | Same template renders in multiple sections             | `APP-BLOCKS-REFERENCE-011`        | ✅     |
| AC-012 | Structure maintained across reference chain            | `APP-BLOCKS-REFERENCE-012`        | ✅     |
| AC-013 | User can complete full reference workflow (regression) | `APP-BLOCKS-REFERENCE-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/blocks/common/block-reference.spec.ts`

---

## Regression Tests

| Spec ID                                   | Workflow                                         | Status |
| ----------------------------------------- | ------------------------------------------------ | ------ |
| `APP-BLOCKS-REGRESSION`                   | Developer creates reusable blocks with variables | ✅     |
| `APP-BLOCKS-LANGUAGE-SWITCHER-REGRESSION` | Language switcher works with i18n configuration  | ✅     |
| `APP-BLOCKS-CHILDREN-REGRESSION`          | Block children render in proper hierarchy        | ✅     |
| `APP-BLOCKS-PROPS-REGRESSION`             | Block props pass to rendered elements            | ✅     |
| `APP-BLOCKS-REFERENCE-REGRESSION`         | Block references resolve and render correctly    | ✅     |

---

## Coverage Summary

| User Story          | Title                   | Spec Count | Status   |
| ------------------- | ----------------------- | ---------- | -------- |
| US-PAGES-BLOCKS-001 | Define Reusable Blocks  | 10         | Complete |
| US-PAGES-BLOCKS-002 | Variable Substitution   | 9          | Complete |
| US-PAGES-BLOCKS-003 | Language Switcher Block | 4          | Complete |
| US-PAGES-BLOCKS-004 | Block Children          | 11         | Complete |
| US-PAGES-BLOCKS-005 | Block Properties        | 15         | Complete |
| US-PAGES-BLOCKS-006 | Block References        | 13         | Complete |
| **Total**           |                         | **62**     |          |
