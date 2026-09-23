# Typography

> `design.typeScale.families` maps a role to a typeface — family, fallback stack, tracking and web-font loading. The sizes live one article away.

Each role key mints a `--font-{role}` custom property and a matching `font-{role}` utility, so type decisions live in config rather than scattered across `className` strings.

```yaml
design:
  typeScale:
    families:
      heading:
        family: Inter
        fallback: 'system-ui, sans-serif'
        letterSpacing: '-0.02em'
      body:
        family: Inter
        fallback: 'system-ui, sans-serif'
      mono:
        family: 'JetBrains Mono'
        fallback: 'ui-monospace, monospace'
```

Role keys are alphabetic and freely chosen. `heading`, `body` and `mono` are the conventional three — Sovrium's prebuilt components look for them — but a design that needs `display` or `caption` simply declares it. The map is open, so it publishes no table of its own; the table below is one face.

**Sizes and leading do not live here.** This key answers _which typeface_; how big an `h2` is and what leading it takes is `design.typeScale.steps`, in the Type Scale article. Three of the fields below are superseded and reach nothing.

## What a face holds

<!-- sovrium:options FontConfigItemSchema -->

`family` is the only required member.

## Loading a web font

Give the role a `url` and Sovrium injects the stylesheet link for you. Nothing else is required — no manual `head` entry, no `@font-face` block.

```yaml
design:
  typeScale:
    families:
      body:
        family: Inter
        fallback: 'system-ui, sans-serif'
        url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap'
```

**Always pair `url` with `fallback`.** A remote font is a network request the first paint does not wait for. Without a fallback stack, text is laid out in the browser default and reflows when the font lands; with one, the swap is a change of typeface rather than a change of layout.

To load several weights, request them in the `url` — a Google Fonts stylesheet takes `wght@400;600` — or point `url` at a self-hosted stylesheet declaring the `@font-face` rules you need. Self-hosting works the same way and keeps the request on your own origin, which matters when a third-party font CDN is not acceptable under your privacy posture.

## The three fields that reach nothing

`weights`, `size` and `lineHeight` decode and then reach nothing. They are documented as **superseded rather than removed**, and the distinction is worth keeping: "deprecated" means _this worked and is going away_, and these three never worked. They keep decoding, because refusing them would stop a booting app in exchange for zero rendering change.

Declare size, leading and weight under `design.typeScale.steps` instead, where each step emits a real custom property and a usable `text-{step}` utility:

```yaml
design:
  typeScale:
    families:
      body:
        family: Inter
        fallback: 'system-ui, sans-serif'
    steps:
      body:
        size: '1rem'
        lineHeight: 1.6
        weight: 400
        font: body
```

Nothing is translated for you, because the shapes genuinely differ: `steps` is per **rung of the ladder** where `families` is per **face**, its `lineHeight` is a ratio where the old one was a free string, and it takes one `weight` where the old one took an array. An automatic mapping would have to guess which face is which rung.

`sovrium validate` prints a `Superseded:` notice naming each declared path, and exits `0`.
