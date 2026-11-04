---
name: "halden-expenses"
description: "A small team's expense claims: each person files what they paid with its receipt and sees only their own claims, finance decides in the app with the receipt beside the claim, and approved claims are exported and marked repaid."
colors:
  background: "oklch(0.985 0.003 160)"
  foreground: "oklch(0.21 0.008 160)"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0.145 0 0)"
  popover: "oklch(1 0 0)"
  popover-foreground: "oklch(0.145 0 0)"
  primary: "oklch(0.52 0.16 160)"
  primary-foreground: "oklch(0.985 0.003 160)"
  secondary: "oklch(0.97 0 0)"
  secondary-foreground: "oklch(0.205 0 0)"
  muted: "oklch(0.967 0.005 160)"
  muted-foreground: "oklch(0.45 0.012 160)"
  accent: "oklch(0.97 0 0)"
  accent-foreground: "oklch(0.205 0 0)"
  destructive: "oklch(0.53 0.17 25)"
  border: "oklch(0.925 0.008 160)"
  input: "oklch(0.65 0 0)"
  ring: "oklch(0.6 0.16 160)"
  primary-hover: "oklch(0.46 0.15 160)"
  primary-active: "oklch(0.42 0.14 160)"
  primary-subtle: "oklch(0.95 0.03 160)"
  primary-subtle-foreground: "oklch(0.38 0.12 160)"
  background-inset: "oklch(0.925 0.008 160)"
  foreground-subtle: "oklch(0.51 0.012 160)"
  foreground-disabled: "oklch(0.71 0.012 160)"
  foreground-inverse: "oklch(0.985 0.003 160)"
  success: "oklch(0.52 0.12 205)"
  warning: "oklch(0.5 0.12 75)"
  destructive-foreground: "oklch(0.985 0.003 160)"
  chart-1: "oklch(0.6 0.13 250)"
  chart-2: "oklch(0.6 0.13 290)"
  chart-3: "oklch(0.6 0.13 50)"
  chart-4: "oklch(0.6 0.13 115)"
  chart-5: "oklch(0.6 0.13 330)"
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
  sm: "0.125rem"
  base: "4px"
  md: "0.25rem"
  lg: "0.375rem"
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

# Design System: halden-expenses

## Overview

This app is rendered by the Sovrium binary from its configuration, on shadcn/ui base-nova on Base UI, set in Geist unless its `design` key names another face.

The front matter above is normative: every colour, type role, radius and spacing step a page may use, under the token name pages write it with. The sections below say where each applies. The sidecar `.impeccable/design.json` carries what the front matter cannot: the dark value of each colour, the shadows, the motion and the breakpoints.

**Key Characteristics:**

- Every amount shows its currency, two decimals, and aligns in a column.
- An employee sees only their own claims, and the page says so plainly.
- Colour means a decision — approved, waiting, rejected — or it is not used.
- The receipt is one click from the claim, never a separate hunt.

<!-- sovrium:narrative:begin section="overview" -->
<!-- sovrium:narrative:end -->

## Colors

Each colour is a CSS custom property of the same name, painted through Tailwind utilities such as `bg-primary` and `text-muted-foreground`. The front matter gives its light value; the `.dark` scheme paints the dark value named beside it.

### Primary

- **primary** (`oklch(0.52 0.16 160)`, dark `oklch(0.78 0.12 160)`): The one accent. Primary action fill, the current nav entry, the focus ring, the first chart series. Never a status and never a category. Pairs with `primary-foreground`.
- **primary-foreground** (`oklch(0.985 0.003 160)`, dark `oklch(0.16 0.006 160)`): Text and icons on a `primary` fill.

### Secondary

- **secondary** (`oklch(0.97 0 0)`, dark `oklch(0.269 0 0)`): The fill of a secondary action.
- **secondary-foreground** (`oklch(0.205 0 0)`, dark `oklch(0.985 0 0)`): Text and icons on a `secondary` fill.

### Tertiary

- **accent** (`oklch(0.97 0 0)`, dark `oklch(0.269 0 0)`): The ground of a hovered or selected menu item or list row.
- **accent-foreground** (`oklch(0.205 0 0)`, dark `oklch(0.985 0 0)`): Text on an `accent` ground.

### Neutral

- **background** (`oklch(0.985 0.003 160)`, dark `oklch(0.16 0.006 160)`): The page ground.
- **foreground** (`oklch(0.21 0.008 160)`, dark `oklch(0.95 0.005 160)`): Running text on the page ground.
- **card** (`oklch(1 0 0)`, dark `oklch(0.21 0.008 160)`): The ground of a card.
- **card-foreground** (`oklch(0.145 0 0)`, dark `oklch(0.985 0 0)`): Text on a card.
- **popover** (`oklch(1 0 0)`, dark `oklch(0.23 0.008 160)`): The ground of menus, popovers and select lists.
- **popover-foreground** (`oklch(0.145 0 0)`, dark `oklch(0.985 0 0)`): Text on a `popover` ground.
- **muted** (`oklch(0.967 0.005 160)`, dark `oklch(0.19 0.007 160)`): Quiet grounds: table headers, disabled fields, a card footer.
- **muted-foreground** (`oklch(0.45 0.012 160)`, dark `oklch(0.75 0.01 160)`): Secondary text: descriptions, placeholders, captions.
- **border** (`oklch(0.925 0.008 160)`, dark `oklch(0.3 0.01 160)`): Dividers, and the edges of cards, tables and outlined buttons.
- **input** (`oklch(0.65 0 0)`, dark `oklch(1 0 0 / 0.4)`): The edge of a form field.
- **ring** (`oklch(0.6 0.16 160)`, dark `oklch(0.72 0.13 160)`): The focus ring.

### Status

- **destructive** (`oklch(0.53 0.17 25)`, dark `oklch(0.72 0.14 25)`): Errors and destructive actions, as text and as a tinted ground.

### App colours

- **primary-hover** (`oklch(0.46 0.15 160)`, dark `oklch(0.83 0.09 160)`): An app colour, painted with `bg-primary-hover`, `text-primary-hover` or `border-primary-hover`.
- **primary-active** (`oklch(0.42 0.14 160)`, dark `oklch(0.87 0.07 160)`): An app colour, painted with `bg-primary-active`, `text-primary-active` or `border-primary-active`.
- **primary-subtle** (`oklch(0.95 0.03 160)`, dark `oklch(0.28 0.06 160)`): Selected and current states on quiet surfaces — the current page, the claim opened in the drawer. Pairs with `primary-subtle-foreground`.
- **primary-subtle-foreground** (`oklch(0.38 0.12 160)`, dark `oklch(0.9 0.06 160)`): An app colour, painted with `bg-primary-subtle-foreground`, `text-primary-subtle-foreground` or `border-primary-subtle-foreground`.
- **background-inset** (`oklch(0.925 0.008 160)`, dark `oklch(0.13 0.005 160)`): An app colour, painted with `bg-background-inset`, `text-background-inset` or `border-background-inset`.
- **foreground-subtle** (`oklch(0.51 0.012 160)`, dark `oklch(0.68 0.012 160)`): An app colour, painted with `bg-foreground-subtle`, `text-foreground-subtle` or `border-foreground-subtle`.
- **foreground-disabled** (`oklch(0.71 0.012 160)`, dark `oklch(0.45 0.01 160)`): An app colour, painted with `bg-foreground-disabled`, `text-foreground-disabled` or `border-foreground-disabled`.
- **foreground-inverse** (`oklch(0.985 0.003 160)`, dark `oklch(0.16 0.006 160)`): An app colour, painted with `bg-foreground-inverse`, `text-foreground-inverse` or `border-foreground-inverse`.
- **success** (`oklch(0.52 0.12 205)`, dark `oklch(0.75 0.12 205)`): A claim Approved or Reimbursed, and nothing else. Pairs with `foreground`.
- **warning** (`oklch(0.5 0.12 75)`, dark `oklch(0.8 0.12 75)`): A claim waiting on a decision. Pairs with `foreground`.
- **destructive-foreground** (`oklch(0.985 0.003 160)`, dark `oklch(0.16 0.006 160)`): An app colour, painted with `bg-destructive-foreground`, `text-destructive-foreground` or `border-destructive-foreground`.
- **chart-1** (`oklch(0.6 0.13 250)`, dark `oklch(0.7 0.12 250)`): An app colour, painted with `bg-chart-1`, `text-chart-1` or `border-chart-1`.
- **chart-2** (`oklch(0.6 0.13 290)`, dark `oklch(0.7 0.12 290)`): An app colour, painted with `bg-chart-2`, `text-chart-2` or `border-chart-2`.
- **chart-3** (`oklch(0.6 0.13 50)`, dark `oklch(0.7 0.12 50)`): An app colour, painted with `bg-chart-3`, `text-chart-3` or `border-chart-3`.
- **chart-4** (`oklch(0.6 0.13 115)`, dark `oklch(0.7 0.12 115)`): An app colour, painted with `bg-chart-4`, `text-chart-4` or `border-chart-4`.
- **chart-5** (`oklch(0.6 0.13 330)`, dark `oklch(0.7 0.12 330)`): An app colour, painted with `bg-chart-5`, `text-chart-5` or `border-chart-5`.

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

- **sm** (`box-shadow: 0 1px 2px rgb(20 20 30 / 0.06)`)
- **md** (`box-shadow: 0 4px 12px rgb(20 20 30 / 0.08)`)
- **lg** (`box-shadow: 0 12px 32px rgb(20 20 30 / 0.14)`)
- **none** (`box-shadow: none`)

<!-- sovrium:narrative:begin section="elevation" -->
<!-- sovrium:narrative:end -->

## Shapes

Corners are set with Tailwind's `rounded-*` utilities, each reading the radius step of the same name.

- **none** (`0`)
- **sm** (`0.125rem`)
- **base** (`4px`)
- **md** (`0.25rem`)
- **lg** (`0.375rem`)
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
