# Blocks Specification

> Reusable UI component templates with variable substitution

## Overview

Blocks are reusable UI component templates that can be referenced across multiple pages. They support variable substitution via `$variable` placeholders, enabling dynamic content injection while maintaining consistent design patterns.

**Vision Alignment**: Blocks enable DRY (Don't Repeat Yourself) principles in Sovrium's configuration-driven UI, allowing teams to define common patterns once and reuse them with context-specific data.

## Schema Structure

**Location**: `src/domain/models/app/block/`

```
block/
├── index.ts              # Exports all block schemas
├── block.ts              # BlockSchema definition
└── common/
    ├── block-reference.ts  # BlockReferenceSchema (3 syntaxes)
    ├── block-props.ts      # BlockPropsSchema
    └── block-children.ts   # BlockChildrenSchema
```

---

## BlockSchema

**Location**: `src/domain/models/app/block/block.ts`

Defines a reusable UI component template.

| Property   | Type                  | Required | Description                       |
| ---------- | --------------------- | -------- | --------------------------------- |
| `name`     | `string`              | Yes      | Unique block identifier           |
| `type`     | `string`              | Yes      | Component type (section, card...) |
| `props`    | `BlockPropsSchema`    | No       | Component properties              |
| `children` | `BlockChildrenSchema` | No       | Nested child components           |
| `content`  | `string`              | No       | Text content with $variables      |

### Block Name Format

| Pattern                         | Description | Examples                              |
| ------------------------------- | ----------- | ------------------------------------- |
| `^[a-z][a-z0-9]*(-[a-z0-9]+)*$` | Kebab-case  | `hero-section`, `feature-card`, `cta` |

### Example Block Definition

```yaml
blocks:
  - name: hero-section
    type: section
    props:
      className: py-20 bg-gradient-to-r from-blue-600 to-purple-600
    children:
      - type: container
        children:
          - type: heading
            props:
              level: 1
              className: text-5xl font-bold text-white
            content: $title
          - type: text
            props:
              className: text-xl text-white/80 mt-4
            content: $subtitle
          - type: button
            props:
              variant: secondary
              size: lg
              className: mt-8
            content: $cta_text
```

---

## BlockReferenceSchema

**Location**: `src/domain/models/app/block/common/block-reference.ts`

References a defined block with variable substitution. Supports three syntax formats.

### Syntax 1: Full Reference (`$ref` + `vars`)

```yaml
sections:
  - $ref: hero-section
    vars:
      title: Welcome to Sovrium
      subtitle: Build apps faster
      cta_text: Get Started
```

### Syntax 2: Hybrid Reference (`block` + `vars`)

```yaml
sections:
  - block: hero-section
    vars:
      title: Welcome to Sovrium
      subtitle: Build apps faster
```

### Syntax 3: Shorthand Reference (`block` only)

```yaml
sections:
  - block: hero-section
```

### Reference Schema Properties

| Syntax    | Property | Type                     | Required | Description          |
| --------- | -------- | ------------------------ | -------- | -------------------- |
| Full      | `$ref`   | `string`                 | Yes      | Block name reference |
| Full      | `vars`   | `Record<string, string>` | No       | Variable values      |
| Hybrid    | `block`  | `string`                 | Yes      | Block name reference |
| Hybrid    | `vars`   | `Record<string, string>` | No       | Variable values      |
| Shorthand | `block`  | `string`                 | Yes      | Block name reference |

### Variable Substitution

Variables use `$variable_name` syntax in block content and props:

```yaml
# Block definition
blocks:
  - name: greeting-card
    type: card
    props:
      className: $card_style
    children:
      - type: heading
        content: Hello, $user_name!
      - type: text
        content: $message

# Block reference with variables
sections:
  - $ref: greeting-card
    vars:
      card_style: bg-white shadow-lg rounded-xl p-6
      user_name: Alice
      message: Welcome back to your dashboard.
```

---

## BlockPropsSchema

**Location**: `src/domain/models/app/block/common/block-props.ts`

Defines component properties for blocks.

### Key Pattern

| Pattern                           | Description          | Examples                          |
| --------------------------------- | -------------------- | --------------------------------- |
| `^[a-z][a-zA-Z0-9]*$`             | camelCase            | `className`, `onClick`, `variant` |
| `^(data-\|aria-)[a-z][a-z0-9-]*$` | Data/ARIA attributes | `data-testid`, `aria-label`       |

### Value Types

| Type      | Description     | Example                         |
| --------- | --------------- | ------------------------------- |
| `string`  | Text value      | `"bg-blue-500"`                 |
| `number`  | Numeric value   | `42`                            |
| `boolean` | Boolean flag    | `true`                          |
| `object`  | Nested object   | `{ color: "blue", size: "lg" }` |
| `array`   | Array of values | `["option1", "option2"]`        |

### Example Props

```yaml
props:
  className: flex items-center gap-4
  variant: primary
  size: lg
  disabled: false
  data-testid: submit-button
  aria-label: Submit form
  style:
    backgroundColor: '#3b82f6'
    padding: '1rem'
```

---

## BlockChildrenSchema

**Location**: `src/domain/models/app/block/common/block-children.ts`

Defines nested child components within a block. Supports recursive nesting.

### Child Element Types

| Type                | Description             |
| ------------------- | ----------------------- |
| `BlockChildElement` | Nested component object |
| `string`            | Text content            |

### BlockChildElement Properties

| Property   | Type                  | Required | Description        |
| ---------- | --------------------- | -------- | ------------------ |
| `type`     | `string`              | Yes      | Component type     |
| `props`    | `BlockPropsSchema`    | No       | Component props    |
| `children` | `BlockChildrenSchema` | No       | Recursive children |
| `content`  | `string`              | No       | Text content       |

### Example Children Structure

```yaml
children:
  - type: flex
    props:
      direction: row
      gap: 4
    children:
      - type: icon
        props:
          name: star
          className: text-yellow-500
      - type: text
        content: $rating
      - type: text
        props:
          className: text-gray-500
        content: ($review_count reviews)
```

---

## Component Types

Blocks can use any of the 40+ component types:

### Layout Components

| Type        | Description           |
| ----------- | --------------------- |
| `section`   | Page section          |
| `container` | Width-constrained box |
| `flex`      | Flexbox container     |
| `grid`      | CSS Grid container    |
| `stack`     | Vertical stack        |

### Content Components

| Type      | Description    |
| --------- | -------------- |
| `heading` | h1-h6 headings |
| `text`    | Paragraph text |
| `link`    | Anchor link    |
| `image`   | Image element  |
| `icon`    | Icon component |
| `badge`   | Status badge   |
| `avatar`  | User avatar    |

### Interactive Components

| Type       | Description     |
| ---------- | --------------- |
| `button`   | Action button   |
| `input`    | Form input      |
| `select`   | Dropdown select |
| `checkbox` | Checkbox input  |
| `radio`    | Radio button    |
| `form`     | Form container  |

### Display Components

| Type        | Description        |
| ----------- | ------------------ |
| `card`      | Card container     |
| `table`     | Data table         |
| `list`      | List container     |
| `accordion` | Collapsible panels |
| `tabs`      | Tab navigation     |
| `modal`     | Modal dialog       |

---

## E2E Test Coverage

| Spec File                                         | Tests | Status  | Description             |
| ------------------------------------------------- | ----- | ------- | ----------------------- |
| `specs/app/blocks/blocks.spec.ts`                 | ~10   | 🟢 100% | Block definition        |
| `specs/app/blocks/common/block-reference.spec.ts` | ~8    | 🟢 100% | Reference syntaxes      |
| `specs/app/blocks/common/block-props.spec.ts`     | ~6    | 🟢 100% | Props validation        |
| `specs/app/blocks/common/block-children.spec.ts`  | ~5    | 🟢 100% | Children structure      |
| `specs/app/blocks/language-switcher.spec.ts`      | ~3    | 🟢 100% | Built-in language block |

**Total**: 5 spec files, ~32 tests

---

## Implementation Status

**Overall**: 🟢 100%

| Component       | Status | Notes                         |
| --------------- | ------ | ----------------------------- |
| BlockSchema     | ✅     | Full template definition      |
| BlockReference  | ✅     | All 3 syntaxes supported      |
| BlockProps      | ✅     | All value types supported     |
| BlockChildren   | ✅     | Recursive nesting supported   |
| Variable Subst. | ✅     | $variable replacement working |

---

## Use Cases

### Example 1: Feature Card Block

```yaml
blocks:
  - name: feature-card
    type: card
    props:
      className: bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow
    children:
      - type: flex
        props:
          direction: column
          gap: 4
        children:
          - type: icon
            props:
              name: $icon
              className: w-12 h-12 text-blue-600
          - type: heading
            props:
              level: 3
              className: text-xl font-semibold
            content: $title
          - type: text
            props:
              className: text-gray-600
            content: $description

pages:
  - name: Features
    path: /features
    sections:
      - type: grid
        props:
          columns: 3
          gap: 6
        children:
          - $ref: feature-card
            vars:
              icon: zap
              title: Lightning Fast
              description: Built for speed with optimized performance.
          - $ref: feature-card
            vars:
              icon: shield
              title: Secure by Default
              description: Enterprise-grade security out of the box.
          - $ref: feature-card
            vars:
              icon: code
              title: Developer Friendly
              description: Clean APIs and comprehensive documentation.
```

### Example 2: Pricing Tier Block

```yaml
blocks:
  - name: pricing-tier
    type: card
    props:
      className: $tier_style
    children:
      - type: heading
        props:
          level: 3
        content: $plan_name
      - type: text
        props:
          className: text-4xl font-bold my-4
        content: $price
      - type: text
        props:
          className: text-gray-500
        content: $billing_period
      - type: list
        props:
          className: mt-6 space-y-3
        children: $features
      - type: button
        props:
          variant: $button_variant
          className: w-full mt-8
        content: $cta_text

pages:
  - name: Pricing
    path: /pricing
    sections:
      - type: flex
        props:
          justify: center
          gap: 8
        children:
          - $ref: pricing-tier
            vars:
              tier_style: border border-gray-200 rounded-xl p-8
              plan_name: Starter
              price: $9/mo
              billing_period: Billed monthly
              button_variant: outline
              cta_text: Start Free Trial
          - $ref: pricing-tier
            vars:
              tier_style: border-2 border-blue-600 rounded-xl p-8 shadow-xl
              plan_name: Pro
              price: $29/mo
              billing_period: Billed monthly
              button_variant: primary
              cta_text: Get Started
```

### Example 3: Testimonial Block

```yaml
blocks:
  - name: testimonial
    type: card
    props:
      className: bg-gray-50 rounded-lg p-6
    children:
      - type: text
        props:
          className: text-lg italic text-gray-700
        content: '$quote'
      - type: flex
        props:
          align: center
          gap: 4
          className: mt-6
        children:
          - type: avatar
            props:
              src: $avatar_url
              alt: $author_name
              size: md
          - type: stack
            props:
              gap: 0
            children:
              - type: text
                props:
                  className: font-semibold
                content: $author_name
              - type: text
                props:
                  className: text-sm text-gray-500
                content: $author_title
```

---

## Related Features

- [Pages](./pages.md) - Pages that use block references
- [Tables](./tables.md) - Data tables within blocks
- [Theme](./theme.md) - Design tokens for block styling

## Related Documentation

- [Component Types](../architecture/patterns/component-types.md) - Full list of component types
- [CSS Compiler](../infrastructure/css/css-compiler.md) - How block styles are compiled
- [Tailwind CSS](../infrastructure/ui/tailwind.md) - Styling utilities for blocks
