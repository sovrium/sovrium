# Tokens: what a design system is made of

A token is a named decision. Sovrium turns each one into a CSS custom property and, for most categories, a utility whose suffix is the token's name — so a decision taken once in `design` is usable from every `className`, `classes` entry and `design.components` block in the app.

## Contents

- [The categories](#the-categories)
- [Naming](#naming)
- [What each name mints](#what-each-name-mints)
- [The token plan](#the-token-plan)
- [Critique: the generic tells at token level](#critique-the-generic-tells-at-token-level)
- [When the block is empty](#when-the-block-is-empty)

## The categories

Every category is a direct key of `design`, named for the decision it makes. All are optional; a usable design can be colours and nothing else.

| Decision                                                        | Key                                               | Article                                                                           |
| --------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------- |
| Which scheme a first visit gets                                 | `colorScheme`                                     | `sovrium docs theming/theme-dark-mode`                                            |
| The palette, and its dark values                                | `colors`, `darkColors`                            | `sovrium docs theming/theme`                                                      |
| Ordered lightness ladders, and what each colour is for          | `ramps`, `colorRoles`                             | `sovrium docs theming/design-components`                                          |
| Faces, and the type ladder                                      | `typeScale.families`, `typeScale.steps`           | `sovrium docs theming/theme-typography`, `sovrium docs theming/design-type-scale` |
| Room, corners, distance off the page                            | `spacing`, `radius`, `elevation`                  | `sovrium docs theming/theme-spacing`                                              |
| Where the layout changes                                        | `breakpoints`                                     | `sovrium docs theming/responsive-design`                                          |
| Durations, easings, keyframes, animations                       | `motion`                                          | `sovrium docs theming/animations`                                                 |
| How tight rows and chips are                                    | `density`                                         | `sovrium docs theming/design-density`                                             |
| How a coloured option badge is drawn                            | `badgeForm`                                       | `sovrium docs theming/design-components`                                          |
| Start from the shipped look or a neutral floor                  | `baseline`                                        | `sovrium docs theming/theme-dark-mode`                                            |
| Every instance of an engine type                                | `components`                                      | `sovrium docs theming/design-components`                                          |
| The charter: routes to zones, mark, imagery, convictions, words | `zones`, `logo`, `imagery`, `principles`, `voice` | `sovrium docs theming/design`                                                     |

Every option of each key, generated from the binary you run: `design-options.generated.md`.

## Naming

- **Name for the role, not the look.** `card`, `section`, `danger`, `brand` survive a redesign; `subtle`, `blue-2` and `8` leave every use to be re-audited.
- **Colour names are lowercase kebab-case**: `primary`, `muted-foreground`, `brand-2`. A name that could not appear in a class name is refused.
- **Use the conventional colour roles first.** The shipped components read shadcn/ui's role names — `background`, `foreground`, `primary`, `card`, `muted-foreground`, `border`, `ring` and their `-foreground` companions — so declaring those restyles the shipped chrome for free. A surface role you declare without its `-foreground` gets one derived for contrast. Add extensions (`success`, `brand`) only when a role is missing. [S5]
- **The shipped components read the `base` and `md` radii.** Any other radius name is yours to use from a class.
- **Spacing step names are lowercase letters, digits and hyphens**, and never a display or size keyword (`block`, `flex`, `full`, `screen`, `none` …) — a step called `full` would redefine `w-full`.

## What each name mints

| Key                         | One entry becomes                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `colors.<name>`             | `--color-<name>`, and `bg-<name>`, `text-<name>`, `border-<name>`                          |
| `spacing.<name>`            | the suffix of every spacing utility: `p-<name>`, `gap-<name>`, `py-<name>` …               |
| `radius.<name>`             | `--radius-<name>` and `rounded-<name>`                                                     |
| `elevation.<name>`          | `shadow-<name>`                                                                            |
| `breakpoints.<name>`        | a min-width media query and the `<name>:` prefix                                           |
| `typeScale.families.<face>` | `--font-<face>` and `font-<face>`                                                          |
| `typeScale.steps.<rung>`    | `--text-<rung>` with its leading, weight, tracking and face, and the `text-<rung>` utility |
| `motion.durations.<name>`   | `--duration-<name>` and `duration-<name>`                                                  |

A plain `border` class with no colour beside it paints `colors.border`, so one token restyles every card and divider.

## The token plan

Write this in the conversation before editing the config, and keep it short. [S2][S3]

```markdown
## Token plan — <app>

Subject: <who it is for, the one job, the world it belongs to>
Principles (2–3): <convictions someone could disagree with>
Bold element (one): <the single memorable decision, and why it earns its place>

| Colour  | Light | Dark | Role (`colorRoles.usage`)                | Pairs with         |
| ------- | ----- | ---- | ---------------------------------------- | ------------------ |
| primary | …     | …    | the one action per view; never body text | primary-foreground |
| …       |       |      |                                          |                    |

Type: faces <body, heading, mono> · rungs used <display?, h1–h3, lead, body, caption>
Radius: base <…>, md <…>, card <…> · Elevation: <flat / card / overlay>
Density: <compact | cozy | roomy, per zone if any>
Motion: <durations and easings, or "none">
Removed or replaced per-instance styles: <list>
```

Four to six named colours is a system; twelve is a paint box. Each colour earns its row by its role.

## Critique: the generic tells at token level

Review the plan against this list, revise anything that is the most likely choice rather than a chosen one, and write down what changed. Page-level tells (the template layout, centring everything, copy) are `sovrium-pages`' anti-slop list. [S2][S11]

| Tell                               | Why it reads as generated                        | Instead                                                                     |
| ---------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------- |
| A palette unrelated to the subject | Nobody chose it for this app                     | Colours from the subject's world: its materials, its signage, its paperwork |
| A two-hue gradient as the brand    | The most recognised generated look               | One flat brand colour spent where it means something                        |
| Every corner the same large radius | Nothing reads as more important                  | A small `base`, a larger radius only on surfaces that need it               |
| Coloured glows and neon outlines   | Ornament that fails in light mode                | The `elevation` ladder; at night, a lighter surface                         |
| Three or more faces                | Noise that weakens hierarchy                     | One face, optionally a second for display or code                           |
| A dark-only palette                | Hides contrast problems; harder to read for most | A light palette, with `darkColors` as the checked alternative               |
| Values written on components       | The system drifts at the one site someone missed | A token, used through its utility                                           |
| Tokens named for their look        | Dies on the next redesign                        | Tokens named for their role                                                 |

A tell the author's brief or `principles` ask for is not a tell.

## When the block is empty

An app that declares no `design` still renders a complete system: shadcn/ui's default palette in both schemes, Geist and Geist Mono served by the binary itself, and the shipped radii and elevation. Use it as it is rather than inventing a brand nobody asked for; propose a token plan to the author instead.
