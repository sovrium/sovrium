---
name: "app-starter"
description: "A starting point for a business app: every sign-in way, a dashboard, settings and profile pages, and a list of records that each open on their own page."
colors:
  background: "oklch(1 0 0)"
  foreground: "oklch(0.145 0 0)"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0.145 0 0)"
  popover: "oklch(1 0 0)"
  popover-foreground: "oklch(0.145 0 0)"
  primary: "oklch(0.205 0 0)"
  primary-foreground: "oklch(0.985 0 0)"
  secondary: "oklch(0.97 0 0)"
  secondary-foreground: "oklch(0.205 0 0)"
  muted: "oklch(0.97 0 0)"
  muted-foreground: "oklch(0.52 0 0)"
  accent: "oklch(0.97 0 0)"
  accent-foreground: "oklch(0.205 0 0)"
  destructive: "oklch(0.5 0.245 27.325)"
  border: "oklch(0.922 0 0)"
  input: "oklch(0.65 0 0)"
  ring: "oklch(0.556 0 0)"
typography: {}
rounded:
  none: "0"
  sm: "0.375rem"
  base: "4px"
  md: "0.5rem"
  lg: "0.625rem"
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

# Design System: app-starter

## Overview

This app is rendered by the Sovrium binary from its configuration, on shadcn/ui base-nova on Base UI, set in Geist unless its `design` key names another face.

The front matter above is normative: every colour, type role, radius and spacing step a page may use, under the token name pages write it with. The sections below say where each applies. The sidecar `.impeccable/design.json` carries what the front matter cannot: the dark value of each colour, the shadows, the motion and the breakpoints.

<!-- sovrium:narrative:begin section="overview" -->
<!-- sovrium:narrative:end -->

## Colors

Each colour is a CSS custom property of the same name, painted through Tailwind utilities such as `bg-primary` and `text-muted-foreground`. The front matter gives its light value; the `.dark` scheme paints the dark value named beside it.

### Primary

- **primary** (`oklch(0.205 0 0)`, dark `oklch(0.922 0 0)`): The fill of the main action of a view, such as the primary button.
- **primary-foreground** (`oklch(0.985 0 0)`, dark `oklch(0.205 0 0)`): Text and icons on a `primary` fill.

### Secondary

- **secondary** (`oklch(0.97 0 0)`, dark `oklch(0.269 0 0)`): The fill of a secondary action.
- **secondary-foreground** (`oklch(0.205 0 0)`, dark `oklch(0.985 0 0)`): Text and icons on a `secondary` fill.

### Tertiary

- **accent** (`oklch(0.97 0 0)`, dark `oklch(0.269 0 0)`): The ground of a hovered or selected menu item or list row.
- **accent-foreground** (`oklch(0.205 0 0)`, dark `oklch(0.985 0 0)`): Text on an `accent` ground.

### Neutral

- **background** (`oklch(1 0 0)`, dark `oklch(0.145 0 0)`): The page ground.
- **foreground** (`oklch(0.145 0 0)`, dark `oklch(0.985 0 0)`): Running text on the page ground.
- **card** (`oklch(1 0 0)`, dark `oklch(0.205 0 0)`): The ground of a card.
- **card-foreground** (`oklch(0.145 0 0)`, dark `oklch(0.985 0 0)`): Text on a card.
- **popover** (`oklch(1 0 0)`, dark `oklch(0.205 0 0)`): The ground of menus, popovers and select lists.
- **popover-foreground** (`oklch(0.145 0 0)`, dark `oklch(0.985 0 0)`): Text on a `popover` ground.
- **muted** (`oklch(0.97 0 0)`, dark `oklch(0.269 0 0)`): Quiet grounds: table headers, disabled fields, a card footer.
- **muted-foreground** (`oklch(0.52 0 0)`, dark `oklch(0.708 0 0)`): Secondary text: descriptions, placeholders, captions.
- **border** (`oklch(0.922 0 0)`, dark `oklch(1 0 0 / 0.1)`): Dividers, and the edges of cards, tables and outlined buttons.
- **input** (`oklch(0.65 0 0)`, dark `oklch(1 0 0 / 0.4)`): The edge of a form field.
- **ring** (`oklch(0.556 0 0)`, dark `oklch(0.556 0 0)`): The focus ring.

### Status

- **destructive** (`oklch(0.5 0.245 27.325)`, dark `oklch(0.704 0.191 22.216)`): Errors and destructive actions, as text and as a tinted ground.

<!-- sovrium:narrative:begin section="colors" -->
<!-- sovrium:narrative:end -->

## Typography

**Body Font:** Geist Variable (with sans-serif)

**Mono Font:** Geist Mono Variable (with monospace)

The app declares no type ladder (`design.typeScale.steps`), so text keeps the platform's sizes, set with Tailwind's `text-*` utilities, in the faces named above.

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

- **sm** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.08)`)
- **md** (`box-shadow: 0 4px 12px rgb(0 0 0 / 0.06)`)
- **lg** (`box-shadow: 0 8px 24px rgb(0 0 0 / 0.12)`)

<!-- sovrium:narrative:begin section="elevation" -->
<!-- sovrium:narrative:end -->

## Shapes

Corners are set with Tailwind's `rounded-*` utilities, each reading the radius step of the same name.

- **none** (`0`)
- **sm** (`0.375rem`)
- **base** (`4px`)
- **md** (`0.5rem`)
- **lg** (`0.625rem`)
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
