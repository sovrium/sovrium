# Dividers & Spacers

> The two structural components that carry no content — divider draws a rule, optionally labelled, and spacer reserves vertical whitespace.

`divider` and `spacer` are the only components with nothing of their own to show. They exist to separate what is around them: one draws a line, the other reserves space. Both accept `props` and `children` and nothing else — no `content`, no `dataSource`, no `responsive`, no `visibility`, no `i18n`.

```yaml
components:
  - { type: text, element: h2, content: 'Personal details' }
  - { type: spacer, props: { size: lg } }
  - { type: divider, props: { style: dashed, label: 'or' } }
  - { type: spacer, props: { size: lg } }
  - { type: text, element: h2, content: 'Company details' }
```

Neither declares a schema option. Both are configured entirely through the open `props` bag, so the tables below describe what the renderer reads rather than a validated shape. Neither refuses an unrecognised key, and the two do different things with one: a `divider` forwards it to the rule as an HTML attribute, while a `spacer` reads only `size`, `className` and `data-testid` and drops everything else on the floor.

## `divider`

A rule between sections, prestyled with the design's border tone.

| `props` key | Description                                                            |
| ----------- | ---------------------------------------------------------------------- |
| `style`     | Line style: `solid` (the default), `dashed` or `dotted`.               |
| `label`     | Text set into the middle of the rule.                                  |
| `className` | Tailwind classes, appended after the prestyle so they win the cascade. |

`style` is applied as an inline `border-style` rather than as a class, so it is unaffected by the token cascade. Any value other than `dashed` or `dotted` falls back to `solid` — a typo produces a plain rule, not an error.

### Labelled dividers

Supplying `label` changes the markup. Instead of a bare `<hr>`, the divider becomes a flex container with `role="separator"` and `aria-label` set to the label, holding two rules with the text between them:

```yaml
- { type: divider, props: { label: 'or continue with', style: solid } }
```

The label renders in the muted foreground tone, so a labelled separator reads as passive chrome rather than as a heading. Because the accessible name comes from `aria-label`, assistive technology announces the separator once — it does not read the visible text a second time.

## `spacer`

Vertical whitespace, sized from a preset. Renders an `aria-hidden` element, so it adds rhythm without adding anything to the accessibility tree.

| `props.size` | Height   | Typical use                           |
| ------------ | -------- | ------------------------------------- |
| `sm`         | `0.5rem` | Between tightly related rows.         |
| `md`         | `1.5rem` | The default — between sibling blocks. |
| `lg`         | `3rem`   | Between subsections.                  |
| `xl`         | `5rem`   | Between major page sections.          |

An unrecognised `size` falls back to `md`. A `props.className` you supply is appended after the height class, so `className: 'h-40'` overrides the preset outright.

**Prefer padding on the parent where you can.** A `spacer` is the right tool when the gap belongs between two siblings and neither owns it — a form section break, a landing-page rhythm beat. When one block owns the gap, put it on that block's `className` instead; there is less markup and it survives reordering.
