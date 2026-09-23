# Baseline & Dark Mode

> What the app looks like before you style anything, and what it looks like at night — `baseline`, `darkColors` and `colorScheme`.

Three keys of `design` decide the starting point: whether the prebuilt components come with a look attached, what the palette becomes under a dark scheme, and which scheme a first-time visitor gets.

## `baseline`

`extend`, the default, makes the prebuilt components inherit Sovrium's own design-system tokens — cards have a border and a shadow, buttons have a fill, form controls have a focus ring — and layers your tokens on top. `replace` drops that look and starts from a neutral, unstyled floor: nothing is prestyled, and every surface is yours to define.

```yaml
design:
  baseline: extend
```

Start with `extend`. It gets a usable app on screen from a handful of colour tokens, and any individual prestyle can still be overridden — an author-supplied `props.className` is appended last, so it wins the Tailwind cascade. Reach for `replace` only when you are building a design system of your own and the defaults are actively in the way.

## `darkColors`

`darkColors` mirrors the `colors` structure and supplies the values used under the dark scheme. One design therefore ships both palettes, and no component needs a `dark:` variant written by hand.

```yaml
design:
  colors:
    background: '#ffffff'
    background-raised: '#f8fafc'
    foreground: '#0f172a'
    foreground-muted: '#64748b'
    primary: '#4f46e5'
  darkColors:
    background: '#0f172a'
    background-raised: '#1e293b'
    foreground: '#f8fafc'
    foreground-muted: '#94a3b8'
    primary: '#818cf8'
```

Only the tokens that need to change have to appear. A token you leave out keeps its light value in both schemes — correct for a brand accent, and usually wrong for anything with `background` or `foreground` in the name.

**Check contrast in both palettes, not one.** A `primary` tuned against a white background is frequently too dark against a near-black one, which is why the example above lightens it rather than reusing it. The pair is two designs, not one design with the lights off.

**`darkColors` overrides the palette; it does not extend it.** A name appearing only here and never in `colors` produces no utility at all, because `bg-{name}` and `text-{name}` are minted from the `colors` block. Declare the token in `colors` first, then give it its second value here.

## `colorScheme`

Which palette a first-time visitor gets, before any preference of theirs is known: `light` and `dark` force one regardless of the operating-system setting, and `system` follows whatever the operating system reports.

A visitor who has since made a choice always overrides this — the stored preference wins on every subsequent visit. `colorScheme` is the default, not the policy.

It is applied before the page's content renders, so a dark-first app does not flash a white page on load.

## The switch

The visitor-facing control is a component, not a design key: put a `theme-toggle` in the header and it writes the stored preference that overrides `colorScheme`.

```yaml
pages:
  - name: Home
    path: /
    components:
      - type: container
        element: header
        props: { className: 'flex items-center justify-between p-4' }
        children:
          - { type: text, element: span, content: 'Acme' }
          - { type: theme-toggle }
```

Omit the toggle and the app follows `colorScheme` forever — a legitimate choice for a single-palette design.
