# Responsive Design

> `design.breakpoints` names the widths at which the layout changes its mind, and every name becomes a Tailwind variant prefix.

A breakpoint is a name and a min-width. Each one becomes a min-width media query and a matching utility prefix, so a single component adapts across screen sizes without a second declaration of it.

```yaml
design:
  breakpoints:
    sm: '640px'
    md: '768px'
    lg: '1024px'
    xl: '1280px'
    '2xl': '1536px'
```

The map is open — names are lowercase alphanumeric and freely chosen — so it publishes no option table. Those five are the standard tiers: large mobile, tablet, laptop, desktop, large desktop.

**Values must be pixel strings.** Each value matches `<number>px`; `rem`, `em` and `%` are refused at decode. A responsive tier is a fixed threshold, and a relative one would move with the root font size — which is the one thing a media query must not do.

## Per-breakpoint overrides

Breakpoints power Tailwind's mobile-first variants. A base utility applies at every size; a prefixed one applies from that breakpoint up.

```yaml
pages:
  - name: Home
    path: /
    components:
      - type: container
        element: section
        props:
          className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
        children:
          - { type: card, props: { className: 'p-4 md:p-6' } }
          - { type: card, props: { className: 'p-4 md:p-6' } }
          - { type: card, props: { className: 'p-4 md:p-6' } }
```

In that example `grid-cols-1` applies everywhere, `md:grid-cols-2` overrides it from 768px up, and `lg:grid-cols-3` overrides it again from 1024px. `p-4` is the base padding and `md:p-6` increases it from the `md` tier.

**Declare the smallest layout as the base.** Always write the unprefixed utility for the narrowest viewport and layer larger screens on top. That guarantees a sensible default before any media query matches — and it is the only ordering in which a missing breakpoint degrades rather than breaks.

## Custom tiers

Define your own names alongside or instead of the standard ones. A custom breakpoint generates a matching utility prefix, nothing else changes.

```yaml
design:
  breakpoints:
    phone: '480px'
    tablet: '834px'
    wide: '1440px'
```

```yaml
pages:
  - name: Home
    path: /
    components:
      - type: container
        props: { className: 'flex-col tablet:flex-row wide:gap-12' }
```
