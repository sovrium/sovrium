---
name: sovrium-design
description: Use when the visual system of a Sovrium app needs to be set or reviewed — it plans and checks the `design` block (colour palette, dark colours, ramps and colour roles, type scale and font families, spacing, radius, elevation, motion, breakpoints, density, zones, logo, imagery, principles and voice) and the four customisation keys `design`, `design.components`, `classes` and `className`. Use for a brand, a theme, design tokens, dark mode colours, fonts, square or rounded corners everywhere, restyling every button or table at once, "it looks like a template", a design-system review, importing tokens from Figma or Claude Design, or `sovrium design-system`. Not this skill for one page's layout, data binding, states or words — that is `sovrium-pages`; nor for page weight or the `ECO_DESIGN_LAYER` lever, which is `sovrium-performance`.
license: BSL-1.1
metadata:
  author: sovrium
  version: '1.0.0'
---

# Sovrium design

A bare agent styles a Sovrium app the way it would style a website it owns: it writes a `theme` block (removed, and refused by `sovrium validate`), pastes the same hex value and `rounded-none` onto forty buttons one `className` at a time, writes `var(--brand)` as a colour (refused: a colour value is exactly one colour), writes `hover:` inside `states.hover` (refused: the engine adds the prefix), declares a dark-only token in `darkColors` that `colors` never declared (it mints nothing), sets sizes and line heights in `design.typeScale.families` (they reach nothing), "cleans up" focus with `ring-0`, and files the light-ink logo under `src`. There is no stylesheet to write: the deliverable is the `design` block and the four customisation keys, and the binary compiles them into one stylesheet per app.

Run the core loop from `sovrium-app` underneath this skill. Manual: `sovrium docs theming/design`, `sovrium docs theming/design-components`, `sovrium docs theming/theme`, `sovrium docs theming/theme-dark-mode`, `sovrium docs theming/theme-typography`, `sovrium docs theming/design-type-scale`, `sovrium docs theming/theme-spacing`, `sovrium docs theming/responsive-design`, `sovrium docs theming/animations`, `sovrium docs theming/design-density`, `sovrium docs theming/design-pages-import`, `sovrium docs admin/design-system-console`, `sovrium docs components/components-overview`.

## Scope

**What the config expresses**: the top-level `design` key — `colorScheme`, `colors`, `darkColors`, `ramps`, `colorRoles`, `typeScale` (`families`, `steps`), `spacing`, `radius`, `elevation`, `motion`, `breakpoints`, `density`, `badgeForm`, `baseline`, `components`, `zones`, `logo`, `imagery`, `principles`, `voice` — and the per-instance `classes` and `props.className` on a page component. Every option: `references/design-options.generated.md`, or `sovrium docs config design.<key>`.

**The one cascade** (later wins a same-property conflict):

```
recipe  <  design.components  <  classes  <  props.className  <  focus floor
```

`design.components.<type>` styles every instance of an engine type; `classes` styles the named parts of one instance; `props.className` reaches one instance's root; the floor keeps a visible focus ring on `button`, `input`, `textarea` and `link`. Details: `references/customisation-keys.md`.

**What the binary does with it**: one stylesheet per app holding the types its pages use and every class written in `className`, `classes` or `design.components`; a brief, a DTCG token document and a portable bundle from `sovrium design-system`; the read-only design-system pages under `/_admin/design-system` (admin only, 404 to everyone else).

**Not here**: one page's layout, binding, states and words (`sovrium-pages`); response weight and the `ECO_*` environment levers (`sovrium-performance`). The app schema has no eco or performance key, and the design block is never the place for one. A page designed first on a canvas is `sovrium-pages` (Design first: the canvas loop); only the colours, type and radii changed in that canvas's Theme menu come back here, through the token import.

## Evidence

Each check proves something different; say which one a finding rests on.

| Evidence                            | Proves                                                                                                      | Does not prove                                                |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `sovrium validate`                  | The block decodes: no removed key, no refused value, no unknown type key                                    | That a part name styles anything — part names are an open set |
| `sovrium design-system <config>`    | What the app paints, light and dark side by side, with roles, voice and principles                          | How a component looks with its content                        |
| `/_admin/design-system/foundations` | Every token at its rendered value in the scheme you read it in, each foreground measured against its ground | Contrast of a pairing you composed by hand on a page          |
| The design-system Components pages  | Your own templates drawn at three widths, and which layer each rendered class came from                     | Engine types (`sovrium docs components` lists those)          |
| The running app in a browser        | The result in both schemes, at three widths, with the keyboard                                              | Anything about pages you did not open                         |

## Survey → Implement → Evaluate

Copy this checklist into your notes and tick it as you go.

```
- [ ] 1 Brief: sovrium design-system <config> — read principles, colour roles, voice, zones first
- [ ] 2 Subject: who the app is for, its one job, the world it belongs to (ask if the request does not say)
- [ ] 3 Token plan: 4–6 named colours with a role each, light and dark; type roles mapped to steps; radius; elevation; one bold element
- [ ] 4 Critique the plan against the generic tells (references/tokens.md); revise; note what changed
- [ ] 5 Edit the design block (and design.components for type-wide styling); remove the per-instance copies it replaces
- [ ] 6 sovrium validate; fix every finding; repeat until valid
- [ ] 7 /_admin/design-system/foundations in light, then ?scheme=dark: contrast measured, no surprise inherited value
- [ ] 8 Keep the app running (the sovrium-app loop) and make one browser pass on the changed pages: both schemes, 375 / 768 / 1280 px, Tab through, reduced motion
- [ ] 9 Fix everything found in one batch; back to 6; at most one confirmation pass; report
```

**Plan in tokens, not in components.** Ground the plan in the subject's world before reaching for a colour: a clinic, a bakery and a law firm should not share a palette. Spend boldness once — one memorable decision, everything else quiet. When the request names a look, follow it, even one this skill would not choose; the author's brief outranks these defaults. [S2][S3]

**Importing from a design tool** is one command, never a hand copy: `sovrium design-system import <file|folder> --config <config>` shows the change, `--write` applies it. Only tokens map; components are never imported. Details: `references/design-system-cli.md`.

## The checklist

Rule ids go in findings. Tags in brackets point to `references/sources.md`.

**CRITICAL — the config refuses it, or a visitor loses something**

- `tok-no-theme-key` — The visual system lives in `design`. A `theme` block is refused, and the refusal names the destination of every member; follow it rather than guessing. `codeBlock` is removed too: delete it. [S20]
- `tok-one-colour-value` — A colour value is exactly one colour: a 6- or 8-digit hex, or one complete `rgb()`, `hsl()` or `oklch()` call with nothing after it. `var()` and `color-mix()` are refused because they are references nothing reading the config can resolve; a token that follows another is a `colorRoles` entry whose `value` names a ramp step. [S12][S21]
- `tok-no-inline-values` — A colour, size, radius or font chosen for the app is declared once in `design` and used through its utility (`bg-coral`, `rounded-card`, `text-h1`). A hex value or an arbitrary class repeated on components is a token waiting to be named. [S2]
- `focus-floor-kept` — Never remove the focus indicator. The floor restores it on `button`, `input`, `textarea` and `link`, only on their `root`, only for a type you declared under `design.components`, and `props.className` still wins over it — so a `focus-visible:ring-0` on one instance ships. [S8]
- `dark-both-palettes` — Check every text and control pairing in both palettes. A `darkColors` name must already exist in `colors`, or it mints nothing. A brand colour left out of `darkColors` keeps its light value at night; a background or foreground left out takes the platform's dark default. [S9][S13]

**HIGH — the system will drift or silently do nothing**

- `cascade-right-layer` — Every instance of a type: `design.components.<type>`. One instance's inner part: `classes`. One instance's root: `props.className`. Never a descendant selector keyed on markup.
- `comp-part-names-checked` — A type key typo (`buton:`) is refused; a part or variant typo (`headr:`) decodes and paints nothing. When a block seems to do nothing, check the part name first, then the design-system console, which names the layer each class came from.
- `comp-states-no-prefix` — Classes under `states.hover`, `states.current` and the rest are written without the state prefix; the engine adds it. `current` is the link to the page being read in a sidebar, a navigation menu or a breadcrumb.
- `comp-replace-last-resort` — `replace: true` drops the recipe for a default wrong in kind, not in degree. It keeps the focus floor and what the component needs to work.
- `type-steps-not-families` — Size, leading, weight and tracking per rung live in `typeScale.steps` (a closed set of twelve rungs); a step's `font` names a face declared in `typeScale.families`. A face's `size`, `lineHeight` and `weights` are superseded and reach nothing. A web font needs a `url`, always paired with a `fallback`. [S16]
- `roles-say-what-for` — Give each colour a `colorRoles` entry: `usage` says what it is for and what it is not for, `pairsWith` names its foreground companion. Every role key names a declared token. [S5]
- `scheme-explicit` — Omitted, `colorScheme` follows the visitor's system; declare `light` for an app meant to stay light. The visitor's switch is the `theme-toggle` component, and their stored choice always wins. [S19]

**MEDIUM — quality of the system**

- `name-for-role` — Name tokens for their role (`card`, `section`, `danger`), never their look (`subtle`, `8`, `blue-2`): a role survives a redesign.
- `radius-recipe-names` — The shipped components read the `base` and `md` radii; declare those to restyle them. `DEFAULT` is refused.
- `ladder-steps-only` — Spacing steps are single `px` or `rem` lengths; breakpoints are `px` only, smallest layout as the unprefixed base. Display and size keywords are refused as step names.
- `motion-explains-change` — Durations and easings are named tokens in `design.motion`; short, `transform` and `opacity` only, nothing infinite on first paint, and every movement has a reduced-motion answer. [S15]
- `density-by-zone` — Density is one ladder of three steps with all five numbers each; `byZone` assigns a step per declared zone. Not every number moves a recipe yet: read `sovrium docs theming/design-density` before promising a change.
- `logo-mode-not-ink` — `logo.srcDark` is the file shown in DARK mode, the light-ink one. `alt` is required with `src`; prefer SVG, root-relative or `https://`.
- `voice-declared` — The voice is part of the system: `design.voice` with `avoid` doing most of the work, `tone` per moment, zones overriding per field. Building one: `references/voice-and-principles.md`. [S14]

**LOW — polish**

- `baseline-extend-first` — Start from `baseline: extend`; `replace` only when building a system of your own.
- `one-icon-set` — Name the one icon set in `imagery.iconSet`.
- `badge-form-once` — `badgeForm` draws every coloured option badge one way, app-wide.
- `principles-first` — Two or three `principles`, each a conviction someone could disagree with.

## Before reporting

A candidate finding is reported only after four checks:

1. **Is it rendered?** Confirm on the running app or the console, not from the config alone — an inherited value may already be right.
2. **Who sees it?** Which pages, which scheme, which width; a pairing that fails only in dark is still a failure.
3. **Is it the author's choice?** A value the brief, `principles` or `colorRoles` ask for is not a finding. The author's system wins; report a tension as a question.
4. **Is the fix in config?** Name the smallest edit and its layer. If the config cannot express it, say so instead of reaching for CSS.

An empty report says "no findings" and lists what was checked; it does not pad.

## Report

```markdown
## Design review — <app>

Scope: <pages, schemes, widths checked> · Brief read: yes/no · Validate: valid/invalid

| Severity | Rule               | Where (file:line)     | Seen in                 | Smallest fix                      | Confidence |
| -------- | ------------------ | --------------------- | ----------------------- | --------------------------------- | ---------- |
| CRITICAL | dark-both-palettes | config/design.yaml:14 | /book, dark, all widths | add `darkColors.muted-foreground` | Confirmed  |

Confidence: Confirmed only when seen rendered or measured on the running app · Likely when read in config or calculated · Needs verification when it could not be checked.
Not changed, needs the author: <list>
Decisions to record: <title — touches>
```

End the report with one `Decisions to record: <title — touches>` line per nominated decision, or `Decisions to record: none`. Nominate only a data-model shape, the permissions or auth model, SQLite versus PostgreSQL, a design character choice, a disabled or deferred automation, or a security trade-off left in place — never labels, copy or colours. Nominate here; the `sovrium-config-editor` agent writes the `decisions:` record, never this skill.

## Must not claim

1. Sovrium has a `theme` key, or that `theme` still works.
2. `var()` or `color-mix()` is an accepted colour value.
3. A `darkColors` name missing from `colors` creates a utility.
4. `design.typeScale.families` sets a size, a line height or a weight.
5. A web font loads without a `url` on its face.
6. The focus floor protects every component, or wins over `props.className`.
7. A mistyped part or variant name is refused.
8. Every density number changes a rendered height today.
9. `design.components` styles the app's own reusable `components` templates.
10. The console, an admin route or an MCP tool edits the design.
11. `sovrium design-system import` brings components back.
12. An eco or performance setting belongs in `design`.

## Old patterns

<details>
<summary>Moving a config off the removed `theme` and `codeBlock` keys</summary>

`sovrium validate` prints this map for a config that still declares `theme`; members became direct keys of `design`:

| Old member                                                                  | Now                                                                                                                                             |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `colors`, `darkColors`, `spacing`, `breakpoints`, `colorScheme`, `baseline` | the same name under `design`                                                                                                                    |
| `fonts`                                                                     | `design.typeScale.families`                                                                                                                     |
| `borderRadius`                                                              | `design.radius`                                                                                                                                 |
| `shadows`                                                                   | `design.elevation`                                                                                                                              |
| `animations`                                                                | `design.motion` — `duration`, `easing` and `keyframes` become `durations`, `easings` and `keyframes`; every other entry goes under `animations` |
| `codeBlock`                                                                 | delete it: code blocks follow the reader's scheme with shadcn/ui's default colours                                                              |

</details>

## References

- [references/tokens.md](references/tokens.md) — read when planning a palette or a token set: the categories, naming, the token plan template, the generic tells to critique against.
- [references/customisation-keys.md](references/customisation-keys.md) — read before restyling any component: the cascade, `design.components` parts, variants, states and `replace`, `classes`, `className`, the focus floor.
- [references/colour-and-dark.md](references/colour-and-dark.md) — read when choosing colours or adding dark mode: accepted values, ramps and roles, `darkColors` inheritance, contrast in both palettes.
- [references/type-and-rhythm.md](references/type-and-rhythm.md) — read when setting fonts, the type scale, spacing, radius, elevation, breakpoints, motion or density.
- [references/voice-and-principles.md](references/voice-and-principles.md) — read when the app needs principles, a voice, a voice chart, zones, a logo or imagery rules.
- [references/design-system-cli.md](references/design-system-cli.md) — read when exporting the system, handing it to a design tool, importing tokens or pages back, or reading the console.
- [references/design-options.generated.md](references/design-options.generated.md) — read for every option of the `design` block in the binary you run; generated from it.
- [references/sources.md](references/sources.md) — the public sources behind the tags above, and the Sovrium decisions this skill states.
