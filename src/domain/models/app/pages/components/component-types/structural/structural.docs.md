# Dividers & Spacers

> The two structural components that carry no content — separator draws a rule, optionally labelled, and spacer reserves vertical whitespace.

`separator` and `spacer` are the only components with nothing of their own to show. They exist to separate what is around them: one draws a line, the other reserves space. Neither takes `content`, `dataSource`, `responsive`, `visibility` or `i18n`.

```yaml
components:
  - { type: text, element: h2, content: 'Personal details' }
  - { type: spacer, props: { size: lg } }
  - { type: separator, label: 'or', props: { style: dashed } }
  - { type: spacer, props: { size: lg } }
  - { type: text, element: h2, content: 'Company details' }
```

A `separator` declares two options, `orientation` and `label`; everything else on either component goes through the open `props` bag, so the `props` tables below describe what the renderer reads rather than a validated shape. Neither refuses an unrecognised `props` key, and the two do different things with one: a `separator` forwards it to the rule as an HTML attribute, while a `spacer` reads only `size`, `className` and `data-testid` and drops everything else on the floor.

## `separator`

A rule between sections, prestyled with the design's border tone. Reference: shadcn/ui Separator. It was named `divider`; a config still writing `type: divider` is refused with a message naming `separator`, and renaming the `type` is the whole migration.

| `props` key | Description                                                            |
| ----------- | ---------------------------------------------------------------------- |
| `style`     | Line style: `solid` (the default), `dashed` or `dotted`.               |
| `className` | Tailwind classes, appended after the prestyle so they win the cascade. |

`orientation: vertical` runs the rule up and down between the items of a row, stretched to the row's height, as in a footer's `Privacy | Terms | Status`; it announces itself as a vertical separator. `horizontal` is the default.

`style` is applied as an inline `border-style` rather than as a class, so it is unaffected by the token cascade. Any value other than `dashed` or `dotted` falls back to `solid` — a typo produces a plain rule, not an error.

### Labelled dividers

Supplying `label` changes the markup. Instead of a bare `<hr>`, the separator becomes a flex container with `role="separator"` and `aria-label` set to the label, holding two rules with the text between them, as shadcn/ui's FieldSeparator draws "Or continue with" between two ways to sign in. A vertical separator draws no label. A `props.label` written before `label` was an option is still read.

```yaml
- { type: separator, label: 'Or continue with' }
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

It holds nothing and paints nothing: it is space, and nothing else. Reference: no shadcn counterpart (shadcn/ui spaces sections with the parent's gap).
