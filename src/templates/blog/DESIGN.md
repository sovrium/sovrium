---
name: "field-notes"
description: "A publication: an index of essays with covers, one page per essay with its byline and approved comments, an RSS feed, and a desk behind sign-in where the editor schedules posts and an assistant proposes drafts."
colors:
  background: "oklch(0.985 0.003 293)"
  foreground: "oklch(0.21 0.008 293)"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0.145 0 0)"
  popover: "oklch(1 0 0)"
  popover-foreground: "oklch(0.145 0 0)"
  primary: "oklch(0.52 0.17 293)"
  primary-foreground: "oklch(0.985 0.003 293)"
  secondary: "oklch(0.97 0 0)"
  secondary-foreground: "oklch(0.205 0 0)"
  muted: "oklch(0.967 0.005 293)"
  muted-foreground: "oklch(0.45 0.012 293)"
  accent: "oklch(0.97 0 0)"
  accent-foreground: "oklch(0.205 0 0)"
  destructive: "oklch(0.53 0.17 25)"
  border: "oklch(0.925 0.008 293)"
  input: "oklch(0.65 0 0)"
  ring: "oklch(0.6 0.17 293)"
  primary-hover: "oklch(0.46 0.159 293)"
  primary-active: "oklch(0.42 0.15 293)"
  primary-subtle: "oklch(0.95 0.03 293)"
  primary-subtle-foreground: "oklch(0.38 0.128 293)"
  background-inset: "oklch(0.925 0.008 293)"
  foreground-subtle: "oklch(0.51 0.012 293)"
  foreground-disabled: "oklch(0.71 0.012 293)"
  foreground-inverse: "oklch(0.985 0.003 293)"
  success: "oklch(0.52 0.12 155)"
  warning: "oklch(0.5 0.12 75)"
  destructive-foreground: "oklch(0.985 0.003 293)"
typography:
  display:
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: 1.05
  headline:
    fontSize: "2.5rem"
    fontWeight: 600
    lineHeight: 1.1
  title:
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
  h3:
    fontSize: "1.1875rem"
    fontWeight: 600
    lineHeight: 1.35
  lead:
    fontSize: "1.25rem"
    lineHeight: 1.55
  body:
    fontSize: "1.0625rem"
    lineHeight: 1.75
  bodySmall:
    fontSize: "0.875rem"
    lineHeight: 1.55
  label:
    fontSize: "0.8125rem"
    lineHeight: 1.4
  overline:
    fontSize: "0.75rem"
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

# Design System: field-notes

## Overview

This app is rendered by the Sovrium binary from its configuration, on shadcn/ui base-nova on Base UI, set in Geist unless its `design` key names another face.

The front matter above is normative: every colour, type role, radius and spacing step a page may use, under the token name pages write it with. The sections below say where each applies. The sidecar `.impeccable/design.json` carries what the front matter cannot: the dark value of each colour, the shadows, the motion and the breakpoints.

**Key Characteristics:**

- A reader reaches a full essay from the index in one click.
- Every essay says who wrote it, when, and what it is about, before its first paragraph.
- Colour means a post's state — published, scheduled, waiting — or it is not used.
- Nothing the assistant writes is published without a person approving it.

<!-- sovrium:narrative:begin section="overview" -->
<!-- sovrium:narrative:end -->

## Colors

Each colour is a CSS custom property of the same name, painted through Tailwind utilities such as `bg-primary` and `text-muted-foreground`. The front matter gives its light value; the `.dark` scheme paints the dark value named beside it.

### Primary

- **primary** (`oklch(0.52 0.17 293)`, dark `oklch(0.78 0.128 293)`): The one accent. Links in an essay, the Publish button, the current entry of the desk, the focus ring. Pairs with `primary-foreground`.
- **primary-foreground** (`oklch(0.985 0.003 293)`, dark `oklch(0.16 0.006 293)`): Text and icons on a `primary` fill.

### Secondary

- **secondary** (`oklch(0.97 0 0)`, dark `oklch(0.269 0 0)`): The fill of a secondary action.
- **secondary-foreground** (`oklch(0.205 0 0)`, dark `oklch(0.985 0 0)`): Text and icons on a `secondary` fill.

### Tertiary

- **accent** (`oklch(0.97 0 0)`, dark `oklch(0.269 0 0)`): The ground of a hovered or selected menu item or list row.
- **accent-foreground** (`oklch(0.205 0 0)`, dark `oklch(0.985 0 0)`): Text on an `accent` ground.

### Neutral

- **background** (`oklch(0.985 0.003 293)`, dark `oklch(0.16 0.006 293)`): The page ground.
- **foreground** (`oklch(0.21 0.008 293)`, dark `oklch(0.95 0.005 293)`): Running text on the page ground.
- **card** (`oklch(1 0 0)`, dark `oklch(0.21 0.008 293)`): The ground of a card.
- **card-foreground** (`oklch(0.145 0 0)`, dark `oklch(0.985 0 0)`): Text on a card.
- **popover** (`oklch(1 0 0)`, dark `oklch(0.23 0.008 293)`): The ground of menus, popovers and select lists.
- **popover-foreground** (`oklch(0.145 0 0)`, dark `oklch(0.985 0 0)`): Text on a `popover` ground.
- **muted** (`oklch(0.967 0.005 293)`, dark `oklch(0.19 0.007 293)`): Quiet grounds: table headers, disabled fields, a card footer.
- **muted-foreground** (`oklch(0.45 0.012 293)`, dark `oklch(0.75 0.01 293)`): Secondary text: descriptions, placeholders, captions.
- **border** (`oklch(0.925 0.008 293)`, dark `oklch(0.3 0.01 293)`): Dividers, and the edges of cards, tables and outlined buttons.
- **input** (`oklch(0.65 0 0)`, dark `oklch(1 0 0 / 0.4)`): The edge of a form field.
- **ring** (`oklch(0.6 0.17 293)`, dark `oklch(0.72 0.138 293)`): The focus ring.

### Status

- **destructive** (`oklch(0.53 0.17 25)`, dark `oklch(0.72 0.14 25)`): Errors and destructive actions, as text and as a tinted ground.

### App colours

- **primary-hover** (`oklch(0.46 0.159 293)`, dark `oklch(0.83 0.096 293)`): An app colour, painted with `bg-primary-hover`, `text-primary-hover` or `border-primary-hover`.
- **primary-active** (`oklch(0.42 0.15 293)`, dark `oklch(0.87 0.074 293)`): An app colour, painted with `bg-primary-active`, `text-primary-active` or `border-primary-active`.
- **primary-subtle** (`oklch(0.95 0.03 293)`, dark `oklch(0.28 0.064 293)`): The current entry of the desk and the tag a reader has picked. Pairs with `primary-subtle-foreground`.
- **primary-subtle-foreground** (`oklch(0.38 0.128 293)`, dark `oklch(0.9 0.064 293)`): An app colour, painted with `bg-primary-subtle-foreground`, `text-primary-subtle-foreground` or `border-primary-subtle-foreground`.
- **background-inset** (`oklch(0.925 0.008 293)`, dark `oklch(0.13 0.005 293)`): An app colour, painted with `bg-background-inset`, `text-background-inset` or `border-background-inset`.
- **foreground-subtle** (`oklch(0.51 0.012 293)`, dark `oklch(0.68 0.012 293)`): An app colour, painted with `bg-foreground-subtle`, `text-foreground-subtle` or `border-foreground-subtle`.
- **foreground-disabled** (`oklch(0.71 0.012 293)`, dark `oklch(0.45 0.01 293)`): An app colour, painted with `bg-foreground-disabled`, `text-foreground-disabled` or `border-foreground-disabled`.
- **foreground-inverse** (`oklch(0.985 0.003 293)`, dark `oklch(0.16 0.006 293)`): An app colour, painted with `bg-foreground-inverse`, `text-foreground-inverse` or `border-foreground-inverse`.
- **success** (`oklch(0.52 0.12 155)`, dark `oklch(0.75 0.12 155)`): A published post. Pairs with `foreground`.
- **warning** (`oklch(0.5 0.12 75)`, dark `oklch(0.8 0.12 75)`): A post scheduled for later, and a draft the assistant proposed that waits for approval. Pairs with `foreground`.
- **destructive-foreground** (`oklch(0.985 0.003 293)`, dark `oklch(0.16 0.006 293)`): An app colour, painted with `bg-destructive-foreground`, `text-destructive-foreground` or `border-destructive-foreground`.

<!-- sovrium:narrative:begin section="colors" -->
<!-- sovrium:narrative:end -->

## Typography

**Body Font:** Geist Variable (with sans-serif)

**Mono Font:** Geist Mono Variable (with monospace)

### Hierarchy

- **Display** (`display` rung: weight 600, 3rem, line height 1.05)
- **Headline** (`h1` rung: weight 600, 2.5rem, line height 1.1)
- **Title** (`h2` rung: weight 600, 1.5rem, line height 1.25)
- **H3** (`h3` rung: weight 600, 1.1875rem, line height 1.35)
- **Lead** (`lead` rung: 1.25rem, line height 1.55)
- **Body** (`body` rung: 1.0625rem, line height 1.75)
- **BodySmall** (`bodySmall` rung: 0.875rem, line height 1.55)
- **Label** (`caption` rung: 0.8125rem, line height 1.4)
- **Overline** (`overline` rung: weight 500, 0.75rem, line height 1.3)

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

### Zones

Each page belongs to the zone its path matches, and a zone's surface brief under `.impeccable/surfaces/` says what kind of surface it is.

- **product**: `/admin/*`
- **marketing**: `everything else`

<!-- sovrium:narrative:begin section="layout" -->
<!-- sovrium:narrative:end -->

## Elevation & Depth

Cards and panels sit flat on the page ground, edged by a hairline rather than lifted; a shadow lifts what floats over the page, such as a menu, a select list or a dialog.

### Shadow Vocabulary

- **sm** (`box-shadow: none`)
- **md** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`)
- **lg** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1)`)
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
