# Design plan — decide before you build

The agent writes a short design plan before it adds or changes a single component. A plan is
cheap to change; a built page is not, and a page built without one drifts toward the generic
defaults every model reaches for (see `anti-slop.md`).

## Contents

- [1. Ask the mode question](#1-ask-the-mode-question)
- [2. Read the app's design block first](#2-read-the-apps-design-block-first)
- [3. Structure in greyscale](#3-structure-in-greyscale)
- [4. Type](#4-type)
- [5. Spacing and rhythm](#5-spacing-and-rhythm)
- [6. Layout and breakpoints](#6-layout-and-breakpoints)
- [7. Colour, last](#7-colour-last)
- [8. One novel element, at most](#8-one-novel-element-at-most)
- [9. The plan template](#9-the-plan-template)

## 1. Ask the mode question

Two questions set the scope. Ask both, and write the answers into the plan.

**What kind of change is this?**

| Mode     | Meaning                                   | What the agent may touch                                                               |
| -------- | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| New page | The route does not exist yet              | Everything on the page, inside the app's existing design block                         |
| Refine   | The page exists and works; it reads rough | Spacing, hierarchy, copy, states. Keep structure, components and tokens                |
| Redesign | The page's structure is wrong for its job | Structure and components. Still keep the app's tokens unless the author asks otherwise |

- Default to **refine** when the request is ambiguous; a redesign is an explicit request, not an inference.
- A refine pass that wants to change structure stops and asks.

**What is the visitor here to do?** Choose one mode per surface (a page, or a zone of pages):

| Visitor mode | The visitor wants to        | What the page optimises for                                  | Typical surfaces                        |
| ------------ | --------------------------- | ------------------------------------------------------------ | --------------------------------------- |
| Persuade     | Decide whether to act       | One clear claim, proof, one primary call to action           | Landing, pricing, sign-up               |
| Operate      | Get a task done, repeatedly | Density, scanning, predictable controls, fast state feedback | Record lists, dashboards, admin screens |
| Read         | Understand something        | Measure (line length), heading hierarchy, calm type          | Docs, articles, policies                |
| Experience   | Be shown something          | Media, pacing, restraint in chrome                           | Galleries, portfolios, showcases        |

- One visitor mode per surface. A page that tries to persuade and operate at once does neither.
- The visitor mode decides density, not the agent's taste: Operate runs dense, Read runs airy.
- An Operate surface follows the conventions people already know from other tools (Jakob's Law); novelty costs them time on every visit.

## 2. Read the app's design block first

The app's own design system is the brief. Character belongs to the app's author, never to the
agent and never to Sovrium's defaults.

- Run `sovrium design-system <config>` and read the whole brief before planning. It carries the app's tokens, principles, voice and usage rules.
- The live key is `design`. Colours live in `design.colors`; a config that still declares `theme` is refused by `sovrium validate`, so never write one.
- Read `design.principles` first: they are the author's reasons, and they outrank any rule in this skill.
- Read `design.colorRoles` before using a colour: it says what each colour is _for_.
- Read `design.voice` before writing a word (see `copy.md`).
- Read `design.zones` if present: a zone may carry its own accent budget and voice departures.
- When the design block is empty or thin, use the platform defaults as they are. Do not invent a brand the author never asked for.
- When the plan needs a token the app does not have, propose adding it to `design`, with the reason, rather than hard-coding a value on one component.
- Token categories and their options: `sovrium docs theming/design`.

## 3. Structure in greyscale

Hierarchy by subtraction: decide what matters by removing, not by adding emphasis.

- Sketch the page as blocks of text in one colour first. If the hierarchy does not read in greyscale, colour will not save it.
- Rank every element on the page: primary (one), secondary (a few), tertiary (the rest).
- One primary action per view. A second equally loud button halves both.
- De-emphasise the tertiary before emphasising the primary: lighter weight, smaller step, muted colour role.
- Remove a label when the value is self-explanatory (an email address needs no "Email:" prefix).
- Group by proximity before reaching for borders, cards or dividers.
- A section that exists only to fill space is deleted, not decorated.

## 4. Type

Type carries most of the hierarchy on a restrained page, so it is planned explicitly.

- Use at most two families: one for text, optionally one for display or code. The app's `design.typeScale.families` decides which.
- Plan five roles, whatever the app's scale calls its steps: **display** (rare, one per page at most), **headline** (page and section titles), **title** (card, dialog and group titles), **body** (reading text), **label** (controls, metadata, table headers).
- Map each role to one step of the app's scale and write the mapping into the plan. Never pick an off-scale size for one component.
- Build hierarchy by weight and colour role before size: a semibold body-size label often outranks a larger regular one.
- Keep body text at the scale's reading size; do not shrink it to fit more.
- Keep reading measure between roughly 45 and 75 characters per line on Read surfaces.
- Tighten line height as size grows: generous on body text, close on display text.
- Headings follow document order: one `h1` per page, no skipped levels. Choose the level for structure and the step for appearance; they are separate decisions.
- Type steps and what each emits: `sovrium docs theming/design-type-scale`.

## 5. Spacing and rhythm

- Use only the app's spacing ladder (`design.spacing`). Every gap is a step, never an arbitrary value.
- Think in a 4 px base with 8 px as the common step; small steps inside a component, larger steps between groups, the largest between sections.
- Space between groups is visibly larger than space within a group, or the grouping disappears.
- Keep line heights on the 4 px grid so text and components share one vertical rhythm.
- Start with too much whitespace and remove it, rather than starting tight and adding.
- Density on Operate surfaces comes from the app's density ladder, not from shaving padding by hand: `sovrium docs theming/design-density`.
- Spacing tokens and their utilities: `sovrium docs theming/theme-spacing`.

## 6. Layout and breakpoints

- Design the smallest width first; widen only when the content asks for it.
- Place breakpoints where the content breaks, not at device names. The app's `design.breakpoints` names them.
- Prefer fluid values for type and spacing on Persuade and Read surfaces: a size that scales between a minimum and a maximum across the viewport (`clamp()`) instead of jumping at each breakpoint.
- Compose layouts from layout components (`container`, `flex`, `grid`, `split-pane`, `sidebar`): `sovrium docs components/layout-components`.
- There is no "hero" component type. A hero is a composition: a heading, a sentence, one action and, if earned, an image.
- Responsive options: `sovrium docs theming/responsive-design`.

## 7. Colour, last

- Colour is the last decision, taken after the page already reads in greyscale.
- Use colour tokens from the app's `design.colors` through the roles in `design.colorRoles`. Never write a raw hex, `rgb()` or an arbitrary colour class on a component.
- Spend colour where it carries meaning the visitor must act on: the primary action, an error, a destructive confirmation.
- Colour inside the author's own data (a status chip, a chart series, a calendar item coloured by a field) is the data speaking, not decoration. Let it render as declared.
- Never place muted grey text on a coloured fill; use the foreground the colour role pairs with.
- Check every text and control pairing against the contrast gates in `accessibility.md` in both light and dark schemes.
- Dark mode is planned now, not patched later (see `states-and-forms.md`).

## 8. One novel element, at most

- A page may carry one element the visitor has not seen elsewhere in the app: an unusual layout, a signature image treatment, a custom interaction.
- Everything else is familiar. Boring, consistent components are what let the one novel element register.
- Operate surfaces usually spend their novelty budget on nothing.
- Name the novel element in the plan and say why it earns its place. If the reason is "it looks better", it does not.

## 9. The plan template

Copy this into the conversation (not into a file unless the author asks) and fill it before
editing the config. Keep it under 40 lines.

```markdown
## Design plan — <page or route>

Change mode: new page | refine | redesign
Visitor mode: Persuade | Operate | Read | Experience
The visitor's one job on this page: <one sentence>

### Brief (from `sovrium design-system`)

- Principles that apply: <quote or "none declared">
- Voice: <pronoun, personality, tone keys declared>
- Zone: <zone name and its budget, or "none">
- Tokens missing for this page: <list, with the proposal to add them to `design`, or "none">

### Hierarchy (greyscale)

1. Primary: <element> — the one action: <verb-first label>
2. Secondary: <elements>
3. Tertiary: <elements>
   Removed: <what was cut and why>

### Type roles

- display: <step or "unused"> · headline: <step> · title: <step> · body: <step> · label: <step>

### Spacing

- Within groups: <step> · between groups: <step> · between sections: <step> · density: <step>

### Layout

- Smallest width: <arrangement> · wider: <what changes, and at which named breakpoint>
- Components: <types from the catalogue>

### Colour

- Where colour is spent, and on which role: <list>

### States

- Empty / loading / error / no permission for each data component: <one line each>

### Novel element

- <element and why it earns its place, or "none">

### Verification

- Widths: 375 / 768 / 1280 · dark scheme · keyboard focus · empty and error states
```
