# Density

> `design.density` is one ladder of three steps — compact, cozy, roomy — each fixing the row padding, field height, small-button height, gutter and dense-text size that rows, cells and chips are drawn from.

How tight is a table row? Before this key the answer was `py-[5px]`, written into a handful of Sovrium's own recipes and nowhere an author could reach. Density was not a token; it was a literal that happened to be the same in several files.

```yaml
design:
  density:
    steps:
      compact: { rowY: 5px, controlH: 36px, buttonH: 28px, gap: 7px, text: 11px }
      cozy: { rowY: 8px, controlH: 40px, buttonH: 32px, gap: 10px, text: 13px }
      roomy: { rowY: 14px, controlH: 44px, buttonH: 36px, gap: 16px, text: 14px }
```

Those are the shipped values. Copying them changes nothing, which makes the block a useful starting point: edit one number and see exactly what it moves.

<!-- sovrium:options DensitySchema depth=2 -->

## The five numbers

<!-- sovrium:options DensityStepSchema -->

Each one emits a custom property the recipes read: `--sv-density-row-y`, `-control-h`, `-button-h`, `-gap` and `-text`.

`controlH` and `buttonH` were one number until they were two, and the reason is worth a sentence. A field and a small button both sit on a line, but they are asked for different things: a field is a place to type, and wants room for a cursor, a descender and a comfortable target; a small button is a label with a box drawn round it, and wants to disappear into a toolbar. Under a single key you could not give the field room without inflating every button beside it. The shipped ladder puts them 8px apart at every step — fields 36 / 40 / 44, buttons 28 / 32 / 36 — and `roomy`'s field lands exactly on the 44px enhanced target.

Every value is a **number followed by `px` or `rem`**. Nothing else decodes — no percentage, no `clamp()`, no unitless number. A step is a fixed, quotable number, and a fluid value is a different feature wearing the same name.

**All five fields are required on every step, and all three steps are required.** The step names are a closed set: `cosy` where you meant `cozy` is refused at boot, naming the key. A ladder missing a rung is not a ladder — a surface would silently fall back to a step you did not intend, and nothing would say so.

## Which step you get

`compact` is the default. It is not merely first in the list: it is the step emitted on `:root`, so every surface renders at `compact` unless something has explicitly asked for another.

```css
:root {
  --sv-density-row-y: 5px; /* compact */
}
[data-density='cozy'] {
  --sv-density-row-y: 8px;
}
[data-density='roomy'] {
  --sv-density-row-y: 14px;
}
```

Anchoring `compact` at the root is deliberate. Its numbers **are** the literals the recipes used to hard-code, so an author who declares a ladder — even one copied verbatim from the block above — gets exactly what they had before. Anchoring `cozy` there instead would have silently loosened every existing table the moment anyone declared a density at all.

## What moves today, and what does not

Three of the five properties are read by shipped recipes, so declaring a ladder changes real rendered padding:

- **`rowY`** — the header cells and body rows of a `table`, bound or static.
- **`text`** — the small in-cell affordances: a JSON preview, an array chip, an inline code span, a colour code, a barcode caption, a geolocation pair.
- **`gap`** — the gutter inside a badge, and the chrome that reuses the badge's layout.

**`controlH` and `buttonH` are emitted and read by nothing yet.** Both custom properties carry your values; no recipe consumes either. Declare them — the schema requires both — but do not expect a field or a button to change height because of them. It is written down here rather than left to be rediscovered as a bug.

**Not the same as the table's density control.** A `table` toolbar can expose a `density` button letting a _reader_ switch row height for themselves, and that preference is theirs and per-viewer. `design.density` is the app-level ladder those surfaces are drawn from. One is a runtime choice by whoever is looking; the other is a design decision by whoever wrote the config.

## `byZone` — declared, not yet wired

`byZone` assigns a step to a zone, so a product surface can be tighter than a marketing one. It decodes and it is validated: a zone name `design.zones` does not declare is refused at boot, listing the zones that do exist.

```yaml
design:
  zones:
    - { pattern: '/app/*', zone: product, accentBudget: product }
    - { pattern: 'everything else', zone: marketing, accentBudget: public }
  density:
    steps:
      compact: { rowY: 5px, controlH: 36px, buttonH: 28px, gap: 7px, text: 11px }
      cozy: { rowY: 8px, controlH: 40px, buttonH: 32px, gap: 10px, text: 13px }
      roomy: { rowY: 14px, controlH: 44px, buttonH: 36px, gap: 16px, text: 14px }
    byZone:
      product: compact
      marketing: roomy
```

**It does not change anything yet.** Nothing writes the `[data-density]` attribute onto a rendered element, so the `cozy` and `roomy` blocks are emitted and never matched. That is why all three steps are emitted regardless of what `byZone` says — it makes the remaining work a wiring change rather than a stylesheet change, and it means a ladder you declare today starts applying without you rewriting it.

## `floors`

Two numbers, and only those two values decode — a lower floor is refused, and so is a higher one. Declaring the key restates a guarantee the engine already holds; omitting it is identical in every respect. It exists so the numbers are readable in a config rather than only in source, and it is honest to say nothing reads the key back.

## What declaring one costs

Sovrium can serve an app-agnostic, precompiled stylesheet to apps that have customised nothing. Declaring `design.density` takes your app off that path: the ladder has to be compiled in, because serving the prebuilt file would leave every table on the platform's `compact` step while your config said otherwise. That is a first-request cost, not a per-request one, and it is the same trade any `design` customisation makes.
