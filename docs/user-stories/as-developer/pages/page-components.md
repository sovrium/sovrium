# Page Components

> **Feature Area**: Pages - Reusable Components
> **Schema**: `src/domain/models/app/component/`, `src/domain/models/app/components.ts`
> **E2E Specs**: `specs/app/components/`

---

## Overview

Components in Sovrium are reusable content components that can be included in page sections. They support variable substitution for dynamic content, allowing a single component definition to be customized per usage. Components also include specialized components like language switchers for internationalization.

---

## US-PAGES-BLOCKS-001: Define Reusable Components

**As a** developer,
**I want to** define reusable content components,
**so that** I can share common components across multiple pages.

### Configuration

```yaml
components:
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
          component: cta-banner
          variables:
            title: Get Started Today
            description: Join thousands of users
            buttonText: Sign Up
            buttonLink: /signup
```

### Acceptance Criteria

| ID     | Criterion                                               | E2E Spec                    | Status |
| ------ | ------------------------------------------------------- | --------------------------- | ------ |
| AC-001 | Components array defines reusable components            | `APP-COMPONENTS-001`        | ✅     |
| AC-002 | Component id must be unique                             | `APP-COMPONENTS-002`        | ✅     |
| AC-003 | Component name must be unique                           | `APP-COMPONENTS-003`        | ✅     |
| AC-004 | Component type determines rendering component           | `APP-COMPONENTS-004`        | ✅     |
| AC-005 | Component content supports template syntax              | `APP-COMPONENTS-005`        | ✅     |
| AC-006 | Missing component reference returns validation error    | `APP-COMPONENTS-006`        | ✅     |
| AC-007 | Empty components array is valid                         | `APP-COMPONENTS-007`        | ✅     |
| AC-008 | Component can be referenced by name in sections         | `APP-COMPONENTS-008`        | ✅     |
| AC-009 | Component can be referenced by id in sections           | `APP-COMPONENTS-009`        | ✅     |
| AC-010 | User can complete full components workflow (regression) | `APP-COMPONENTS-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/components/components.spec.ts`

---

## US-PAGES-BLOCKS-002: Variable Substitution

**As a** developer,
**I want to** use variable placeholders in components,
**so that** I can customize component content at each usage point.

### Configuration

```yaml
components:
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
          component: feature-card
          variables:
            icon: rocket
            title: Fast Performance
            description: Lightning fast builds
            # link uses default value '#'
```

### Acceptance Criteria

| ID     | Criterion                                        | E2E Spec             | Status |
| ------ | ------------------------------------------------ | -------------------- | ------ |
| AC-001 | Variables use {{variableName}} syntax            | `APP-COMPONENTS-010` | ✅     |
| AC-002 | Variables are replaced with provided values      | `APP-COMPONENTS-011` | ✅     |
| AC-003 | Missing variable without default returns error   | `APP-COMPONENTS-012` | ✅     |
| AC-004 | Variables support default values via pipe syntax | `APP-COMPONENTS-013` | ✅     |
| AC-005 | Variables support nested object access           | `APP-COMPONENTS-014` | ✅     |
| AC-006 | Variables are type-safe when schema defined      | `APP-COMPONENTS-015` | ✅     |
| AC-007 | Empty variable value renders empty string        | `APP-COMPONENTS-016` | ✅     |
| AC-008 | Variables support array iteration                | `APP-COMPONENTS-017` | ✅     |
| AC-009 | Variables support conditional rendering          | `APP-COMPONENTS-018` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/components/components.spec.ts`

---

## US-PAGES-BLOCKS-003: Language Switcher Component

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

components:
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
          component: lang-switcher
```

### Acceptance Criteria

| ID     | Criterion                                                      | E2E Spec                                      | Status |
| ------ | -------------------------------------------------------------- | --------------------------------------------- | ------ |
| AC-001 | Language switcher displays available languages                 | `APP-COMPONENTS-LANGUAGE-SWITCHER-001`        | ✅     |
| AC-002 | Language switcher changes current language on selection        | `APP-COMPONENTS-LANGUAGE-SWITCHER-002`        | ✅     |
| AC-003 | Language switcher highlights current language                  | `APP-COMPONENTS-LANGUAGE-SWITCHER-003`        | ✅     |
| AC-004 | User can complete full language switcher workflow (regression) | `APP-COMPONENTS-LANGUAGE-SWITCHER-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/components/language-switcher.spec.ts`

---

## US-PAGES-BLOCKS-004: Component Children

**As a** developer,
**I want to** nest child elements within components,
**so that** I can create complex hierarchical UI structures.

### Configuration

```yaml
components:
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

| ID     | Criterion                                             | E2E Spec                             | Status |
| ------ | ----------------------------------------------------- | ------------------------------------ | ------ |
| AC-001 | Component renders nested child components             | `APP-COMPONENTS-CHILDREN-001`        | ✅     |
| AC-002 | Child elements maintain proper hierarchy              | `APP-COMPONENTS-CHILDREN-002`        | ✅     |
| AC-003 | Child with variables inherits parent context          | `APP-COMPONENTS-CHILDREN-003`        | ✅     |
| AC-004 | Unlimited nesting depth is supported                  | `APP-COMPONENTS-CHILDREN-004`        | ✅     |
| AC-005 | Child with conditional visibility works               | `APP-COMPONENTS-CHILDREN-005`        | ✅     |
| AC-006 | Composite children from multiple sources render       | `APP-COMPONENTS-CHILDREN-006`        | ✅     |
| AC-007 | SVG icons render within children                      | `APP-COMPONENTS-CHILDREN-007`        | ✅     |
| AC-008 | Text elements render correctly in children            | `APP-COMPONENTS-CHILDREN-008`        | ✅     |
| AC-009 | All child types render in single component            | `APP-COMPONENTS-CHILDREN-009`        | ✅     |
| AC-010 | Hierarchical structure preserves across renders       | `APP-COMPONENTS-CHILDREN-010`        | ✅     |
| AC-011 | User can complete full children workflow (regression) | `APP-COMPONENTS-CHILDREN-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/components/common/component-children.spec.ts`

---

## US-PAGES-BLOCKS-005: Component Properties (Props)

**As a** developer,
**I want to** define properties on components,
**so that** I can pass configuration values and control rendering behavior.

### Configuration

```yaml
components:
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

| ID     | Criterion                                          | E2E Spec                          | Status |
| ------ | -------------------------------------------------- | --------------------------------- | ------ |
| AC-001 | Props validates any valid prop name                | `APP-COMPONENTS-PROPS-001`        | ✅     |
| AC-002 | Props render as HTML attributes                    | `APP-COMPONENTS-PROPS-002`        | ✅     |
| AC-003 | String values render correctly                     | `APP-COMPONENTS-PROPS-003`        | ✅     |
| AC-004 | Numeric values render correctly                    | `APP-COMPONENTS-PROPS-004`        | ✅     |
| AC-005 | Boolean renders as data attribute                  | `APP-COMPONENTS-PROPS-005`        | ✅     |
| AC-006 | Object renders as JSON data attribute              | `APP-COMPONENTS-PROPS-006`        | ✅     |
| AC-007 | Array renders as JSON data attribute               | `APP-COMPONENTS-PROPS-007`        | ✅     |
| AC-008 | All value types render correctly                   | `APP-COMPONENTS-PROPS-008`        | ✅     |
| AC-009 | Combined style and class props work together       | `APP-COMPONENTS-PROPS-009`        | ✅     |
| AC-010 | Complete component renders with all props          | `APP-COMPONENTS-PROPS-010`        | ✅     |
| AC-011 | Props resolve translation keys                     | `APP-COMPONENTS-PROPS-011`        | ✅     |
| AC-012 | Props resolve nested translation keys              | `APP-COMPONENTS-PROPS-012`        | ✅     |
| AC-013 | Props resolve translation with fallback            | `APP-COMPONENTS-PROPS-013`        | ✅     |
| AC-014 | Props work with both translations and variables    | `APP-COMPONENTS-PROPS-014`        | ✅     |
| AC-015 | User can complete full props workflow (regression) | `APP-COMPONENTS-PROPS-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/components/common/component-props.spec.ts`

---

## US-PAGES-BLOCKS-006: Component References

**As a** developer,
**I want to** reference components by name or ID,
**so that** I can reuse component definitions across pages and sections.

### Configuration

```yaml
components:
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
          component: hero-section # Reference by name
          variables:
            title: Welcome Home
      - type: custom
        props:
          id: hero-2
          component: hero-section # Reference by name
          variables:
            title: Welcome Again
```

### Acceptance Criteria

| ID     | Criterion                                              | E2E Spec                              | Status |
| ------ | ------------------------------------------------------ | ------------------------------------- | ------ |
| AC-001 | Component reference validates minimal structure        | `APP-COMPONENTS-REFERENCE-001`        | ✅     |
| AC-002 | Component lookup includes referenced definition        | `APP-COMPONENTS-REFERENCE-002`        | ✅     |
| AC-003 | Component name validates kebab-case format             | `APP-COMPONENTS-REFERENCE-003`        | ✅     |
| AC-004 | Invalid reference fails validation                     | `APP-COMPONENTS-REFERENCE-004`        | ✅     |
| AC-005 | Reference provides all data for rendering              | `APP-COMPONENTS-REFERENCE-005`        | ✅     |
| AC-006 | Reference validates JavaScript-safe identifiers        | `APP-COMPONENTS-REFERENCE-006`        | ✅     |
| AC-007 | Reference substitutes primitive variables              | `APP-COMPONENTS-REFERENCE-007`        | ✅     |
| AC-008 | Reference renders badge with variables                 | `APP-COMPONENTS-REFERENCE-008`        | ✅     |
| AC-009 | Reference renders section with nested content          | `APP-COMPONENTS-REFERENCE-009`        | ✅     |
| AC-010 | Reference transforms abstract to HTML elements         | `APP-COMPONENTS-REFERENCE-010`        | ✅     |
| AC-011 | Same template renders in multiple sections             | `APP-COMPONENTS-REFERENCE-011`        | ✅     |
| AC-012 | Structure maintained across reference chain            | `APP-COMPONENTS-REFERENCE-012`        | ✅     |
| AC-013 | User can complete full reference workflow (regression) | `APP-COMPONENTS-REFERENCE-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/components/common/component-reference.spec.ts`

---

## Regression Tests

| Spec ID                                       | Workflow                                             | Status |
| --------------------------------------------- | ---------------------------------------------------- | ------ |
| `APP-COMPONENTS-REGRESSION`                   | Developer creates reusable components with variables | ✅     |
| `APP-COMPONENTS-LANGUAGE-SWITCHER-REGRESSION` | Language switcher works with i18n configuration      | ✅     |
| `APP-COMPONENTS-CHILDREN-REGRESSION`          | Component children render in proper hierarchy        | ✅     |
| `APP-COMPONENTS-PROPS-REGRESSION`             | Component props pass to rendered elements            | ✅     |
| `APP-COMPONENTS-REFERENCE-REGRESSION`         | Component references resolve and render correctly    | ✅     |

---

## Coverage Summary

| User Story          | Title                       | Spec Count | Status   |
| ------------------- | --------------------------- | ---------- | -------- |
| US-PAGES-BLOCKS-001 | Define Reusable Components  | 10         | Complete |
| US-PAGES-BLOCKS-002 | Variable Substitution       | 9          | Complete |
| US-PAGES-BLOCKS-003 | Language Switcher Component | 4          | Complete |
| US-PAGES-BLOCKS-004 | Component Children          | 11         | Complete |
| US-PAGES-BLOCKS-005 | Component Properties        | 15         | Complete |
| US-PAGES-BLOCKS-006 | Component References        | 13         | Complete |
| **Total**           |                             | **62**     |          |
