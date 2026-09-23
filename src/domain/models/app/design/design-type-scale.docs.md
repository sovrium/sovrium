# Type Scale

> `design.typeScale.steps` is the app's type ladder — twelve named rungs, each a bound size, leading, weight and tracking — and the one design key that emits a usable Tailwind utility per step.

A brand charter's type section is a ladder: display, then the heading levels, then body, then the small print. Each rung is a bound triple — a size, the leading that goes with it, and the weight it is set in.

```yaml
design:
  typeScale:
    steps:
      h1:
        size: '3rem'
        lineHeight: 1.1
        weight: 700
        letterSpacing: '-0.02em'
      body:
        size: '1rem'
        lineHeight: 1.6
      caption:
        size: '0.8125rem'
        lineHeight: 1.4
```

Every step is optional. An app declaring only `h1` and `body` has a real, if short, scale — the key is meant to be adopted a rung at a time.

## The twelve rungs

The set is **closed**, and the order below is the order the ladder is published in — largest first — whatever order you wrote the keys in. A name outside it is refused by name at validation: `h7` is reported as an unknown key rather than silently ignored.

- `display` — the one-off page-opening size, above `h1`.
- `h1` — page title. One per page.
- `h2` — section heading.
- `h3` — sub-section heading.
- `h4`, `h5`, `h6` — the remaining heading levels.
- `lead` — the standfirst paragraph that opens a page, set larger than body.
- `body` — running text. The rung every other one is measured against.
- `bodySmall` — secondary running text: help text, dense tables.
- `caption` — labels, timestamps, footnotes.
- `overline` — the small tracked-out eyebrow above a heading.

`h1` through `h6` are deliberately the names the `text` component already emits as `element:`, so a rung is something a renderer can bind to rather than a string it has to guess at.

## What a rung holds

<!-- sovrium:options TypeScaleStepSchema -->

`size` is the only required member, because a rung declaring nothing but a size is a real and common state — the leading and weight inherit. A rung declaring leading and no size names no size at all and cannot render.

`font` names a **face** rather than a family, so the binding survives a retune: a rung reading `font: title` follows the title face wherever you change it, whereas an inlined `'Inter'` is a copy that goes stale silently. It is cross-checked against the faces you declared, so an unresolvable name is refused rather than emitted as a dangling variable.

```yaml
design:
  typeScale:
    families:
      title:
        family: Inter
        fallback: 'system-ui, sans-serif'
    steps:
      display:
        size: '4.5rem'
        lineHeight: 1.05
        weight: 800
        font: title
```

## What it emits

Every declared rung becomes a Tailwind type token: one custom property for the size, and one modifier per optional member.

```css
:root {
  --text-h1: 3rem;
  --text-h1--line-height: 1.1;
  --text-h1--font-weight: 700;
  --text-h1--letter-spacing: -0.02em;
  --text-h1--font-family: var(--font-title);
}
```

The variables reach `:root` unconditionally, so anything can read `var(--text-h1)`. The matching `text-h1` **utility** is generated the way every Tailwind utility is — when the class name appears in a `className` the build-time scan can see. Applying it sets the size and folds in the leading, weight, tracking and face in one class. That is the whole point of the key: a rung you can use, not a variable nobody can reach.

## Why the units are what they are

Each constraint tracks the W3C Design Tokens type the rung serialises to, because a value the export cannot carry faithfully is a value the charter cannot publish.

- **`size` takes `px` or `rem` and nothing else** — the two units a DTCG dimension permits. A fluid `clamp(1rem, 2vw, 3rem)` is refused rather than quietly accepted: fluid type is a layout technique for the one element that needs it, whereas a type scale is a ladder of fixed, quotable steps. Reach for a utility class on that element instead.
- **`lineHeight` is a number, not a string.** DTCG types it as a number, and the better practice agrees independently: a ratio survives a size change, whereas a fixed `24px` leading silently becomes wrong the moment the rung is retuned.
- **`letterSpacing` additionally takes `em`, which DTCG does not.** `-0.02em` is the idiomatic tracking value in essentially every type scale ever written, and refusing it to satisfy a serialisation format would be the format dictating the design. It is honoured in the browser verbatim, and named in the export's `unmappable` list at its exact config path.

## In the export

`sovrium design-system` and the two admin export endpoints publish the ladder as a **Type scale** section, in the canonical order above. In the DTCG document each rung is a `typography` composite token.
