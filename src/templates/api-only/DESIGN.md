---
name: "task-api"
description: "A headless API: projects and tasks behind a REST API, called with an API key, with per-role rules on every table and one page that says how to call it."
colors:
  background: "oklch(0.985 0.003 190)"
  foreground: "oklch(0.21 0.008 190)"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0.145 0 0)"
  popover: "oklch(1 0 0)"
  popover-foreground: "oklch(0.145 0 0)"
  primary: "oklch(0.52 0.12 190)"
  primary-foreground: "oklch(0.985 0.003 190)"
  secondary: "oklch(0.97 0 0)"
  secondary-foreground: "oklch(0.205 0 0)"
  muted: "oklch(0.967 0.005 190)"
  muted-foreground: "oklch(0.45 0.012 190)"
  accent: "oklch(0.97 0 0)"
  accent-foreground: "oklch(0.205 0 0)"
  destructive: "oklch(0.53 0.17 25)"
  border: "oklch(0.925 0.008 190)"
  input: "oklch(0.65 0 0)"
  ring: "oklch(0.6 0.12 190)"
  primary-hover: "oklch(0.46 0.112 190)"
  primary-active: "oklch(0.42 0.106 190)"
  primary-subtle: "oklch(0.95 0.03 190)"
  primary-subtle-foreground: "oklch(0.38 0.09 190)"
  background-inset: "oklch(0.925 0.008 190)"
  foreground-subtle: "oklch(0.51 0.012 190)"
  foreground-disabled: "oklch(0.71 0.012 190)"
  foreground-inverse: "oklch(0.985 0.003 190)"
  destructive-foreground: "oklch(0.985 0.003 190)"
typography:
  display:
    fontFamily: "Geist Mono Variable, ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.1
  headline:
    fontFamily: "Geist Mono Variable, ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "Geist Mono Variable, ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.3
  h3:
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.35
  lead:
    fontSize: "0.9375rem"
    lineHeight: 1.5
  body:
    fontSize: "0.875rem"
    lineHeight: 1.5
  bodySmall:
    fontSize: "0.8125rem"
    lineHeight: 1.45
  label:
    fontFamily: "Geist Mono Variable, ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "0.75rem"
    lineHeight: 1.4
  overline:
    fontFamily: "Geist Mono Variable, ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.3
rounded:
  none: "0"
  sm: "0.25rem"
  base: "4px"
  md: "0.5rem"
  lg: "0.75rem"
  xl: "0.875rem"
  "2xl": "1.125rem"
  "3xl": "1.375rem"
  "4xl": "1.625rem"
  full: "9999px"
spacing: {}
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-destructive:
    textColor: "{colors.destructive}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
  input:
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0.25rem 0.625rem"
    height: "2rem"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.xl}"
    padding: "1rem"
  badge:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.4xl}"
    height: "1.25rem"
  popover:
    backgroundColor: "{colors.popover}"
    textColor: "{colors.popover-foreground}"
    rounded: "{rounded.lg}"
---

<!-- sovrium:generated design-md. Regenerate with sovrium design-system --format design-md --output DESIGN.md. Write by hand only inside the sovrium:narrative blocks. -->

# Design System: task-api

## Overview

This app is rendered by the Sovrium binary from its configuration, on shadcn/ui base-nova on Base UI, set in Geist unless its `design` key names another face.

The front matter above is normative: every colour, type role, radius and spacing step a page may use, under the token name pages write it with. The sections below say where each applies. The sidecar `.impeccable/design.json` carries what the front matter cannot: the dark value of each colour, the shadows, the motion and the breakpoints.

**Key Characteristics:**

- A developer copies the first command and the first call within ten seconds of landing.
- Every call on the page works when pasted as written, credential included.
- Colour means a refused call, or it is not used.
- The API is understood without a tour.

<!-- sovrium:narrative:begin section="overview" -->
<!-- sovrium:narrative:end -->

## Colors

Each colour is a CSS custom property of the same name, painted through Tailwind utilities such as `bg-primary` and `text-muted-foreground`. The front matter gives its light value; the `.dark` scheme paints the dark value named beside it.

### Primary

- **primary** (`oklch(0.52 0.12 190)`, dark `oklch(0.78 0.09 190)`): The one accent. The method of the endpoint in view, the focus ring, the one action on the page. Pairs with `primary-foreground`.
- **primary-foreground** (`oklch(0.985 0.003 190)`, dark `oklch(0.16 0.006 190)`): Text and icons on a `primary` fill.

### Secondary

- **secondary** (`oklch(0.97 0 0)`, dark `oklch(0.269 0 0)`): The fill of a secondary action.
- **secondary-foreground** (`oklch(0.205 0 0)`, dark `oklch(0.985 0 0)`): Text and icons on a `secondary` fill.

### Tertiary

- **accent** (`oklch(0.97 0 0)`, dark `oklch(0.269 0 0)`): The ground of a hovered or selected menu item or list row.
- **accent-foreground** (`oklch(0.205 0 0)`, dark `oklch(0.985 0 0)`): Text on an `accent` ground.

### Neutral

- **background** (`oklch(0.985 0.003 190)`, dark `oklch(0.16 0.006 190)`): The page ground.
- **foreground** (`oklch(0.21 0.008 190)`, dark `oklch(0.95 0.005 190)`): Running text on the page ground.
- **card** (`oklch(1 0 0)`, dark `oklch(0.21 0.008 190)`): The ground of a card.
- **card-foreground** (`oklch(0.145 0 0)`, dark `oklch(0.985 0 0)`): Text on a card.
- **popover** (`oklch(1 0 0)`, dark `oklch(0.23 0.008 190)`): The ground of menus, popovers and select lists.
- **popover-foreground** (`oklch(0.145 0 0)`, dark `oklch(0.985 0 0)`): Text on a `popover` ground.
- **muted** (`oklch(0.967 0.005 190)`, dark `oklch(0.19 0.007 190)`): Quiet grounds: table headers, disabled fields, a card footer.
- **muted-foreground** (`oklch(0.45 0.012 190)`, dark `oklch(0.75 0.01 190)`): Secondary text: descriptions, placeholders, captions.
- **border** (`oklch(0.925 0.008 190)`, dark `oklch(0.3 0.01 190)`): Dividers, and the edges of cards, tables and outlined buttons.
- **input** (`oklch(0.65 0 0)`, dark `oklch(1 0 0 / 0.4)`): The edge of a form field.
- **ring** (`oklch(0.6 0.12 190)`, dark `oklch(0.72 0.098 190)`): The focus ring.

### Status

- **destructive** (`oklch(0.53 0.17 25)`, dark `oklch(0.72 0.14 25)`): Errors and destructive actions, as text and as a tinted ground.

### App colours

- **primary-hover** (`oklch(0.46 0.112 190)`, dark `oklch(0.83 0.068 190)`): An app colour, painted with `bg-primary-hover`, `text-primary-hover` or `border-primary-hover`.
- **primary-active** (`oklch(0.42 0.106 190)`, dark `oklch(0.87 0.053 190)`): An app colour, painted with `bg-primary-active`, `text-primary-active` or `border-primary-active`.
- **primary-subtle** (`oklch(0.95 0.03 190)`, dark `oklch(0.28 0.045 190)`): The endpoint selected in a list of endpoints. Pairs with `primary-subtle-foreground`.
- **primary-subtle-foreground** (`oklch(0.38 0.09 190)`, dark `oklch(0.9 0.045 190)`): An app colour, painted with `bg-primary-subtle-foreground`, `text-primary-subtle-foreground` or `border-primary-subtle-foreground`.
- **background-inset** (`oklch(0.925 0.008 190)`, dark `oklch(0.13 0.005 190)`): An app colour, painted with `bg-background-inset`, `text-background-inset` or `border-background-inset`.
- **foreground-subtle** (`oklch(0.51 0.012 190)`, dark `oklch(0.68 0.012 190)`): An app colour, painted with `bg-foreground-subtle`, `text-foreground-subtle` or `border-foreground-subtle`.
- **foreground-disabled** (`oklch(0.71 0.012 190)`, dark `oklch(0.45 0.01 190)`): An app colour, painted with `bg-foreground-disabled`, `text-foreground-disabled` or `border-foreground-disabled`.
- **foreground-inverse** (`oklch(0.985 0.003 190)`, dark `oklch(0.16 0.006 190)`): An app colour, painted with `bg-foreground-inverse`, `text-foreground-inverse` or `border-foreground-inverse`.
- **destructive-foreground** (`oklch(0.985 0.003 190)`, dark `oklch(0.16 0.006 190)`): An app colour, painted with `bg-destructive-foreground`, `text-destructive-foreground` or `border-destructive-foreground`.

<!-- sovrium:narrative:begin section="colors" -->
<!-- sovrium:narrative:end -->

## Typography

**Body Font:** Geist Variable (with sans-serif)

**Mono Font:** Geist Mono Variable (with ui-monospace, SF Mono, Menlo, Consolas, monospace)

### Hierarchy

- **Display** (`display` rung: set in Geist Mono Variable, ui-monospace, SF Mono, Menlo, Consolas, monospace, weight 600, 2rem, line height 1.1)
- **Headline** (`h1` rung: set in Geist Mono Variable, ui-monospace, SF Mono, Menlo, Consolas, monospace, weight 600, 1.375rem, line height 1.2)
- **Title** (`h2` rung: set in Geist Mono Variable, ui-monospace, SF Mono, Menlo, Consolas, monospace, weight 600, 1.0625rem, line height 1.3)
- **H3** (`h3` rung: weight 600, 0.875rem, line height 1.35)
- **Lead** (`lead` rung: 0.9375rem, line height 1.5)
- **Body** (`body` rung: 0.875rem, line height 1.5)
- **BodySmall** (`bodySmall` rung: 0.8125rem, line height 1.45)
- **Label** (`caption` rung: set in Geist Mono Variable, ui-monospace, SF Mono, Menlo, Consolas, monospace, 0.75rem, line height 1.4)
- **Overline** (`overline` rung: set in Geist Mono Variable, ui-monospace, SF Mono, Menlo, Consolas, monospace, weight 500, 0.6875rem, line height 1.3)

<!-- sovrium:narrative:begin section="typography" -->
<!-- sovrium:narrative:end -->

## Layout

Gaps and padding use Tailwind's spacing utilities (`p-4`, `gap-6`). A step the app names is in the front matter's `spacing`, written as its own utility.

### Breakpoints

- **sm** (from `40rem`)
- **md** (from `48rem`)
- **lg** (from `64rem`)
- **xl** (from `80rem`)
- **2xl** (from `96rem`)

<!-- sovrium:narrative:begin section="layout" -->
<!-- sovrium:narrative:end -->

## Elevation & Depth

Cards and panels sit flat on the page ground, edged by a hairline rather than lifted; a shadow lifts what floats over the page, such as a menu, a select list or a dialog.

### Shadow Vocabulary

- **sm** (`box-shadow: none`)
- **md** (`box-shadow: 0 0 0 1px rgb(16 32 36 / 0.08)`)
- **lg** (`box-shadow: 0 12px 32px rgb(16 32 36 / 0.14)`)
- **none** (`box-shadow: none`)

<!-- sovrium:narrative:begin section="elevation" -->
<!-- sovrium:narrative:end -->

## Shapes

Corners are set with Tailwind's `rounded-*` utilities, each reading the radius step of the same name.

- **none** (`0`)
- **sm** (`0.25rem`)
- **base** (`4px`)
- **md** (`0.5rem`)
- **lg** (`0.75rem`)
- **xl** (`0.875rem`)
- **2xl** (`1.125rem`)
- **3xl** (`1.375rem`)
- **4xl** (`1.625rem`)
- **full** (`9999px`)

<!-- sovrium:narrative:begin section="shapes" -->
<!-- sovrium:narrative:end -->

## Components

Pages are built from Sovrium components that render shadcn/ui's anatomy. The front matter draws the canonical ones: `button-primary`, `button-secondary`, `button-outline`, `button-destructive`, `input`, `card`, `badge`, `popover`. Each paints with the tokens it names, and states such as hover and focus come from the same tokens.

<!-- sovrium:narrative:begin section="components" -->
<!-- sovrium:narrative:end -->

## Do's and Don'ts

How this design changes: in the app's `design` key, in `design.components` for a component everywhere it appears, and in a component's `classes` or `className` for one place. Then regenerate this file with `sovrium design-system --format design-md --output DESIGN.md`.

### Do:

- **Do** change a colour, radius, spacing step or type rung in the app's `design` key, then regenerate this file.
- **Do** restyle a component everywhere through `design.components`.
- **Do** adjust one element through its `classes` or `className`, with the token utilities this file names.
- **Do** build pages from shadcn/ui components, by their shadcn names.
- **Do** refer to colours, radii and spacing by the token names in the front matter.

### Don't:

- **Don't** write a CSS, HTML or font file: the Sovrium binary renders every page and does not load one.
- **Don't** invent a new visual world: this app is shadcn/ui base-nova on Base UI.
- **Don't** paste a literal colour or size into a page: name its token.
- **Don't** edit this file outside its narrative blocks: the next export rewrites it.

<!-- sovrium:narrative:begin section="dos-and-donts" -->
<!-- sovrium:narrative:end -->
