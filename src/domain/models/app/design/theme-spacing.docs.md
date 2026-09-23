# Spacing, Radius & Elevation

> Three ladders that decide how much room things take and how far they sit off the page, plus the syntax theme for fenced code.

All four keys are plain name-to-value maps, all four are optional, and each step's **name** becomes the suffix of a real utility. That is the point of declaring one: a later change to the page rhythm is a one-line config edit rather than a find-and-replace across every page.

## `spacing`

One ordered ladder of lengths. Each value is a single length in `px` or `rem`.

```yaml
design:
  spacing:
    '0': '0px'
    px: '1px'
    '0-5': '0.125rem'
    '4': '1rem'
    section: '5rem'
```

Each name becomes the suffix of every spacing utility — padding, margin, gap and the rest — so the `section` step above makes `py-section` and `gap-section` real.

**A class list is refused.** A step used to accept any string and drop what was not a length when the stylesheet was emitted, which meant a config could validate and reach nothing; a value that is not a length is now refused at decode. A token the whole app inherits is a measurement, not a layout recipe — a reusable class list belongs on `props.className`, where it is one node's business.

Step names are lowercase letters, digits and hyphens. A name that could not appear in a class name is refused, and the message names the ladder it was under.

## `radius`

Named corner radii. Each becomes a `--radius-{name}` custom property and a `rounded-{name}` utility.

```yaml
design:
  radius:
    base: '0.25rem'
    card: '0.75rem'
    button: '0.5rem'
    pill: '9999px'
```

The two names Sovrium's own recipes read are `base` and `md`, so declaring those two restyles the shipped components; any other name is yours to use from a `className`.

**`DEFAULT` is refused by name.** It was the one name that did not become `--radius-{name}`: it emitted the bare `--radius`, which no shipped rule reads, so a corner declared there was never drawn. Because that failure was silent — the config validated, the variable was emitted, and nothing rounded — the key is rejected rather than left accepted. Declare `base` instead.

## `elevation`

Named `box-shadow` values. Each becomes a `shadow-{name}` utility.

```yaml
design:
  elevation:
    card: '0 4px 6px rgba(0, 0, 0, 0.1)'
    elevated: '0 10px 30px rgba(0, 0, 0, 0.2)'
```

**Name tokens for their role, not their look.** `shadow-card` and `rounded-card` survive a redesign that changes what a card looks like; `shadow-subtle` and `rounded-8` do not, and leave every usage site to be re-audited by hand.

## `codeBlock`

The syntax-highlighting theme applied to markdown fenced code — on markdown pages, in content directories, and in any `text` component rendering markdown.

<!-- sovrium:options CodeBlockConfigSchema -->

Omit `darkTheme` and the one theme governs both colour schemes; the pair is declared rather than derived from the light theme's name.

```yaml
design:
  codeBlock:
    theme: github-light
    darkTheme: github-dark
```

This is a single global choice rather than a per-block one, so a documentation site's samples stay visually consistent whichever page they appear on.

## Composing them

Tokens compose the way handwritten classes do. The point is that the decisions are named and central:

```yaml
design:
  spacing:
    section: '5rem'
  radius:
    card: '1rem'
  elevation:
    card: '0 1px 3px rgba(0, 0, 0, 0.08)'
pages:
  - name: Home
    path: /
    components:
      - type: container
        props: { className: 'py-section' }
        children:
          - { type: card, props: { className: 'rounded-card shadow-card' } }
```
