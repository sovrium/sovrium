# Type and rhythm

Faces, the type ladder, and the ladders that decide room, corners, distance, breakpoints, motion and density. Each is a named scale; a value off the scale on one component is the drift this file exists to prevent.

## Contents

- [Faces: typeScale.families](#faces-typescalefamilies)
- [The ladder: typeScale.steps](#the-ladder-typescalesteps)
- [Spacing, radius, elevation](#spacing-radius-elevation)
- [Breakpoints](#breakpoints)
- [Motion](#motion)
- [Density](#density)

## Faces: typeScale.families

A face is a role key (alphabetic, freely chosen) mapped to a typeface. Each mints `--font-<face>` and `font-<face>`. `heading`, `body` and `mono` are the conventional three the shipped components look for. Manual: `sovrium docs theming/theme-typography`.

| Member                                                                        | Reaches                                                                                |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `family` (required), `fallback`, `style`, `letterSpacing`, `transform`, `url` | the rendered face                                                                      |
| `size`, `lineHeight`, `weights`                                               | **nothing** — superseded; `sovrium validate` prints a `Superseded:` notice and exits 0 |

```yaml
design:
  typeScale:
    families:
      heading:
        family: Fraunces
        fallback: 'Georgia, serif'
        url: 'https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&display=swap'
      body:
        family: Inter
        fallback: 'system-ui, sans-serif'
        url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap'
```

- **No `url`, no web font.** The `url` is what makes Sovrium inject the stylesheet link; without it the name is only a `font-family` the visitor's machine may not have.
- **Always pair `url` with `fallback`.** First paint does not wait for a remote font; with a fallback stack the swap changes the face, not the layout. [S16]
- **Weights are requested in the `url`** (`wght@400;600`), or by a self-hosted stylesheet declaring the `@font-face` rules you need. Self-hosting keeps the request on your own origin when a third-party font host is not acceptable.
- **The default faces**, when no family is declared, are Geist and Geist Mono, served by the binary itself; no font host is contacted. Declaring a `body` face turns the Geist preload off.
- **One or two faces.** A third weakens hierarchy more than it adds character.

## The ladder: typeScale.steps

Twelve rungs, a closed set, published largest first: `display`, `h1` … `h6`, `lead`, `body`, `bodySmall`, `caption`, `overline`. A name outside the set is refused. Each rung holds `size` (required, `px` or `rem`), `lineHeight` (a unitless ratio), `weight` (100–900), `letterSpacing` and `font` (the name of a declared face). Manual: `sovrium docs theming/design-type-scale`.

```yaml
design:
  typeScale:
    steps:
      h1:
        size: '2.5rem'
        lineHeight: 1.1
        weight: 700
        letterSpacing: '-0.02em'
        font: heading
      body:
        size: '1rem'
        lineHeight: 1.6
        font: body
```

- Each declared rung becomes a `text-<rung>` utility that sets size, leading, weight, tracking and face in one class — use it rather than restating them.
- Adopt the ladder a rung at a time; an app declaring only `h1` and `body` has a real, if short, scale.
- Tighten leading as size grows: generous on body, close on display.
- The heading level is structure, the rung is appearance: two decisions. Which rung each page element uses is `sovrium-pages`' design plan.

## Spacing, radius, elevation

Three plain name-to-value maps; each name becomes the suffix of a real utility. Manual: `sovrium docs theming/theme-spacing`.

| Key         | Values                          | Mints                      | Note                                                                    |
| ----------- | ------------------------------- | -------------------------- | ----------------------------------------------------------------------- |
| `spacing`   | one length in `px` or `rem`     | `p-<name>`, `gap-<name>` … | a class list is refused; display and size keywords are refused as names |
| `radius`    | one length                      | `rounded-<name>`           | the shipped components read `base` and `md`; `DEFAULT` is refused       |
| `elevation` | a `box-shadow` value, or `none` | `shadow-<name>`            | `none` draws no shadow and keeps the focus ring                         |

```yaml
design:
  spacing:
    section: '5rem'
  radius:
    base: '0.375rem'
    md: '0.5rem'
    card: '0.875rem'
  elevation:
    card: '0 1px 3px rgba(0, 0, 0, 0.08)'
```

- "Softer corners everywhere" is `radius.base` and `radius.md`, not `rounded-xl` on every component.
- Name for the role: `shadow-card` survives a redesign, `shadow-subtle` does not.
- The DTCG export keeps an elevation value's raw text in its extensions, because a CSS shadow cannot be decomposed faithfully.

## Breakpoints

A name and a `px` min-width; each becomes a media query and a `<name>:` prefix. `rem`, `em` and `%` are refused, because a threshold must not move with the root font size. Write the unprefixed utility for the narrowest layout and layer wider ones on top. Manual: `sovrium docs theming/responsive-design`.

## Motion

`design.motion` holds four sibling maps: `durations`, `easings`, `keyframes` and `animations`. Duration and easing names become utilities (`duration-fast`); keyframe values may reference a palette colour with `$colors.<name>`. Manual: `sovrium docs theming/animations`.

- Motion explains a change of state; "no motion" is often the right answer.
- Short durations, `transform` and `opacity`, no bounce on work surfaces, nothing infinite on first paint.
- Every movement has a `prefers-reduced-motion` answer: an instant change or a short fade. [S15]

## Density

One ladder of exactly three steps — `compact`, `cozy`, `roomy` — each with all five numbers (`rowY`, `controlH`, `buttonH`, `gap`, `text`, each `px` or `rem`). `default` names the step every page runs at; `byZone` overrides it per zone and refuses a zone `design.zones` does not declare. Every page carries its step as `data-density` on `<html>`. Manual: `sovrium docs theming/design-density`.

- Not every number is read by a recipe yet; the article says which move rendered padding today. Do not promise a field or button height change from this key.
- A table's own `rowHeight` is one grid's choice inside the ladder, not the ladder.
