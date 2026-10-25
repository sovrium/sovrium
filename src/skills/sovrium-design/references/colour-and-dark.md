# Colour and dark mode

Colour is the decision most often made by feel and most often wrong at night. This file is the Sovrium side of it: what a colour value may be, how roles say what a colour is for, and what the dark scheme inherits when you say nothing.

## Contents

- [What a colour value may be](#what-a-colour-value-may-be)
- [Palette, ramps and roles](#palette-ramps-and-roles)
- [Restyle the shipped chrome through its roles](#restyle-the-shipped-chrome-through-its-roles)
- [The dark scheme](#the-dark-scheme)
- [Which scheme a visitor gets](#which-scheme-a-visitor-gets)
- [Contrast, in both palettes](#contrast-in-both-palettes)
- [Data colours](#data-colours)

## What a colour value may be

Exactly one colour: a 6- or 8-digit hex (`#3b5bdb`, `#3b5bdb80`), or one complete `rgb()`, `rgba()`, `hsl()`, `hsla()` or `oklch()` call with nothing after its closing parenthesis.

- **Refused**: `var(--x)` and `color-mix(…)`, because they are references nothing reading the config can resolve — not the contrast check, not the token export, not an agent. Anything trailing the colour (`rgb(0 0 0) url(…)`, `oklch(…); color: red`) is refused too, because it would reach the stylesheet every page loads. [S21]
- **Prefer `oklch()` for ladders.** It is the space in which a ramp can be retuned by lightness without the hue drifting, and the space Sovrium's own ramps are written in. [S12]
- **To follow another token**, use a `colorRoles` entry whose `value` names a ramp step, not CSS.

## Palette, ramps and roles

| Key          | Answers                          | Shape                                                               |
| ------------ | -------------------------------- | ------------------------------------------------------------------- |
| `colors`     | What colours does the app have?  | an open map, lowercase kebab-case name → one colour                 |
| `ramps`      | Which ordered lightness ladders? | `<ramp>.<50…950>` → a colour or another ramp's step (`neutral-500`) |
| `colorRoles` | What is each colour FOR?         | `<role>.usage`, `.pairsWith`, `.value`, `.dark`                     |

```yaml
design:
  ramps:
    neutral:
      '50': 'oklch(0.985 0 0)'
      '500': 'oklch(0.56 0 0)'
      '950': 'oklch(0.14 0 0)'
  colorRoles:
    background:
      value: neutral-50
      dark: neutral-950
      usage: The page ground. Never a fill on a control.
      pairsWith: foreground
```

- `usage` says what the colour is for and, more usefully, what it is not for. That sentence is what stops the next author from picking it by feel.
- `pairsWith` names the token it is designed to sit against, usually its foreground companion; it may name a platform role you never redeclared.
- Every role key must name a token your palette declares, or carry a `value` (which then defines the token). A role for a missing token is refused, and the refusal lists the tokens that exist.
- A ramp reference that resolves to nothing is refused at boot, listing the ramps that exist.
- Declare only the ramp steps you use.

## Restyle the shipped chrome through its roles

The shipped components read shadcn/ui's role names. Declaring `primary`, `background`, `foreground`, `card`, `muted-foreground`, `border` and `ring` restyles every button, card, field and divider without touching a component. [S5]

- If the coral is the app's primary action colour, it is `colors.primary` — not a new token applied to every button.
- A surface role declared without its `-foreground` (`primary`, `secondary`, `accent`, `muted`, `card`, `popover`, `destructive`) gets one derived for contrast: white while white reaches 3:1 against it, else near-black. Declare the foreground yourself when the brand needs a specific one.
- A sidebar's own primary and ring follow `primary` and `ring` unless you declare the `sidebar-*` roles.
- Every page is painted in `background` (`darkColors.background` at night), so a short page never shows the browser's white below it.

## The dark scheme

`darkColors` mirrors `colors` and holds the values used under the dark scheme. No component needs a `dark:` variant by hand.

```yaml
design:
  colors:
    background: '#ffffff'
    foreground: '#0f172a'
    muted-foreground: '#64748b'
    primary: '#1b2a4a'
    coral: '#ff6f59'
  darkColors:
    background: '#0b1220'
    foreground: '#f1f5f9'
    muted-foreground: '#94a3b8'
    primary: '#9fb4e6'
```

What a token you leave out of `darkColors` becomes at night:

| Left out                                                                                        | At night                                                                                     |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| A brand colour (`primary`, `secondary`, `accent`, `ring`, a sidebar brand role, a chart series) | Keeps its light value, and its light foreground, everywhere it is read                       |
| A background, card, body text or border                                                         | Takes the platform's dark default, because kept light it would draw dark text on a dark page |
| A colour of your own the platform has no dark default for (`coral`)                             | Keeps its light value                                                                        |

- **A name only in `darkColors` mints nothing.** `bg-<name>` and `text-<name>` are minted from `colors`; declare the token there first, then its dark value. `sovrium validate` accepts the stray name, so check the console rather than trusting a clean validate.
- **Dark is a second design, not the lights off.** A primary tuned against white is often too dark against near-black: lighten it. Fully saturated accents vibrate on dark grounds: desaturate them. Raised surfaces at night are a lighter surface, not a darker shadow. Avoid large areas of pure black under pure white text. [S9]
- **The logo has a dark file**: `design.logo.srcDark` is the one shown in dark mode, the light-ink file.
- **Code blocks** follow the reader's scheme on their own; no key chooses their colours.

## Which scheme a visitor gets

| `colorScheme`        | First visit                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| omitted, or `system` | Follows the operating system; an app with no `darkColors` is drawn on the platform's default dark palette |
| `light` / `dark`     | Forced, whatever the system says                                                                          |

A visitor's stored choice wins on every later visit. The switch is the `theme-toggle` component, placed in a header; omit it and the app follows `colorScheme` forever. The scheme is applied before content renders, so a dark-first app does not flash white. [S19]

## Contrast, in both palettes

Check every pairing twice, once per palette. Targets are WCAG 2.2's: 4.5:1 for body text, 3:1 for large text and for the boundary of a control or a focus indicator against what surrounds it. [S13]

- `/_admin/design-system/foundations` measures each `*-foreground` against the colour it sits on, and every other colour against `background`, in the scheme you are reading (`?scheme=dark` for the other).
- Never place muted text on a coloured fill; use the foreground the role pairs with.
- A pairing you compose on a page (a coloured card with your own text colour) is not measured by the console: check it in the browser in both schemes.

## Data colours

Colours inside the author's data — a status chip, a chart series, an option of a single-select field — are the data speaking. They render as fills with a derived foreground, drawn as `design.badgeForm` says (`filled` or `outline-dot`) on every surface. Check that chips stay legible and delimited on the dark ground; do not restyle them per page.
