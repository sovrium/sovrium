# Theme Overview & Colors

> Named colour tokens, how each one becomes a CSS custom property and a Tailwind utility, and the two rules a palette is decoded against.

`design` holds the app's design system as named tokens. Every token becomes a CSS custom property and a Tailwind utility class, so a design decision made in config is available to every `className` in the app. Every category is optional — a usable design can be colours and nothing else.

**There is no `theme` key.** Every token category is a DIRECT key of `design`, named for the decision it makes rather than for the CSS property that renders it. A config still declaring `theme` is refused by `sovrium validate`, with the destination for each member in the message.

The Design System article lists every key of `design` and what each decides. This one is about `colors`.

## `colors`

Named colour tokens, as key-value pairs. Each `name` mints a `--color-{name}` custom property plus the `bg-{name}`, `text-{name}` and `border-{name}` utilities.

```yaml
design:
  colors:
    primary: '#3b82f6'
    secondary: '#8b5cf6'
    accent: '#f59e0b'
    background: '#ffffff'
    text: '#0f172a'
    muted: '#64748b'
    muted-foreground: '#94a3b8'
```

The map is open — declare whatever vocabulary the design needs — so it publishes no option table. Two rules are enforced when the config decodes, which is what makes a malformed palette fail `sovrium validate` instead of shipping a broken stylesheet:

- **The token name is lowercase kebab-case.** `primary`, `muted-foreground`, `brand-2`. No camelCase, no underscores — a name that could not appear in a class name would mint a utility nobody can write.
- **The value is 6- or 8-digit hex, or an `rgb(`, `rgba(`, `hsl(` or `hsla(` function.** Nothing else decodes.

Sovrium's own prebuilt components look for the conventional roles — `primary`, `background`, `text`, `muted` — so supplying those restyles the shipped chrome for free.

## Where the other categories are documented

`colors` is one of twenty keys. The rest have their own articles:

- **Baseline & Dark Mode** — `baseline`, `colorScheme`, `darkColors`.
- **Typography** — `typeScale.families`, the faces.
- **Type Scale** — `typeScale.steps`, the ladder each face is set on.
- **Spacing, Radius & Elevation** — `spacing`, `radius`, `elevation`, `codeBlock`.
- **Responsive Design** — `breakpoints`.
- **Animations** — `motion`.
- **Density** — `density`.
- **Component Styles** — `components`, `ramps`, `colorRoles`.
- **Design System** — `zones`, `logo`, `imagery`, `principles`, `voice`, and the export.

## A design, end to end

```yaml
design:
  baseline: extend
  colorScheme: system
  colors:
    primary: '#6366f1'
    background: '#ffffff'
    foreground: '#0f172a'
  darkColors:
    background: '#0f172a'
    foreground: '#f8fafc'
  typeScale:
    families:
      body: { family: Inter, fallback: 'system-ui, sans-serif' }
    steps:
      body: { size: '1rem', lineHeight: 1.6 }
  spacing:
    section: '5rem'
  radius:
    card: '0.75rem'
```
