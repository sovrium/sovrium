# Component Styles

> `design.components` adds your classes to every instance of an engine component type (parts, variants and states), layered over Sovrium's recipe or replacing it, under a focus-ring floor that outranks both.

`props.className` restyles **one** component. `design.components` restyles **every instance of a type**.

The difference matters more than it sounds. Before this key, an app that wanted square corners on every button repeated the same class list at every call site. The failure mode is not an error message. It is the one site somebody missed, found later by a customer.

```yaml
design:
  components:
    button:
      parts:
        root: rounded-none tracking-tight
```

Every button in the app, in one line.

## Where it sits in the cascade

Four layers, applied in this order. A later layer wins a same-property conflict:

1. **Sovrium's recipe**: the shipped default for the type.
2. **`design.components`**: this key. Your app-wide answer. For a `text`, its `elements` entry sits inside this layer, after `parts.root` and before the variant and the states.
3. **`props.className`**: the one instance. Beats your own app-wide rule, which is what makes a one-off override possible without an escape hatch.
4. **The floor**: a small, non-negotiable set, applied last.

## Keyed by component type, not by your component names

The keys are **engine** component types, the ones Sovrium itself draws: `button`, `table`, `dialog`, `input`, and every other type the kit ships. Your own reusable templates under the top-level `components[]` key are not styled from here; you already control those end to end, and what they carry instead is `guidance`.

**The key set is closed.** A typo (`buton:` where you meant `button:`) is refused at boot, naming the key. An open map would accept it, tell you the config is valid, and serve an app that ignored every class you wrote under it, with nothing anywhere saying so.

Two types are excluded, each for the same underlying reason: there is no Sovrium-owned element to attach a class to. `customHTML` renders markup you supply, and `command` emits no visible markup on the server: a config block and its runtime, with the overlay built in the browser on the first invocation.

## What a type entry holds

<!-- sovrium:options ComponentStyleSchema -->

All four are optional, and every leaf is a Tailwind class-list string. Within one part they layer in declaration order (`parts`, then the active `variants` entry, then any matching `states` entry), so a state class is later than a variant class and wins a conflict between them.

### `parts`

Every component has a `root`. A composite one names its inner elements too: a `table` has a `header`, a `row`, a `cell`.

```yaml
design:
  components:
    table:
      parts:
        root: border-2
        header: uppercase tracking-wide
        cell: font-mono
```

A part is an element the renderer owns, so **a part name the type does not have is refused**. `sovrium validate` and the server both name the path, the type and the parts it does have:

```text
design.components.code.parts.copyButton: copyButton is not a part of code. Its parts are: root, frame, caption, copy.
```

The same holds under every `variants` and `states` entry, and every offender is listed. `root` is a part of every type, and a type not listed below has `root` only. Variant names stay an open set: a variant the type never draws is accepted and styles nothing.

| Key                    | Parts beyond `root`                                                                                                                                                                                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `carousel`, `gallery`  | `grid`, `card`, `cover`, `body`                                                                                                                                                                                                                                                              |
| `code`                 | `frame`, `caption`, `copy`                                                                                                                                                                                                                                                                   |
| `event-calendar`       | `event`, `day`, `dayNumber`, `columnHeader`, `toolbar`                                                                                                                                                                                                                                       |
| `file-preview`         | `stage`, `toolbar`                                                                                                                                                                                                                                                                           |
| `form`                 | `title`, `description`, `body`, `label`, `input`, `submit`, `error`                                                                                                                                                                                                                          |
| `kpi`                  | `value`                                                                                                                                                                                                                                                                                      |
| `language-switcher`    | `link`                                                                                                                                                                                                                                                                                       |
| `list`                 | `list`, `item`, `title`, `subtitle`, `meta`                                                                                                                                                                                                                                                  |
| `markdown`             | the prose parts, plus `frame`, `sidebar`, `navGroup`, `navGroupLabel`, `navLink`, `menuButton`, `toc`, `tocLinkActive`, `article`, `articleHeader`, `articleActions`, `articleLinks`, `lastUpdated`                                                                                          |
| `select`               | `trigger`, `label`, `icon`, `list`                                                                                                                                                                                                                                                           |
| `sidebar`              | `inner`, `nav`, `groupLabel`, `link`, `badge`                                                                                                                                                                                                                                                |
| `stepper`              | `rail`, `step`, `panel`, `footer`                                                                                                                                                                                                                                                            |
| `table`                | `caption`, `header`, `row`, `cell` on a table with rows written in `tableRows` and no `dataSource`; `chip` on a table bound with `dataSource`, which reads no other part                                                                                                                     |
| `tabs`                 | `list`, `panel`                                                                                                                                                                                                                                                                              |
| `text`, `record-field` | the prose parts: `heading1`, `heading2`, `heading3`, `paragraph`, `listItem`, `list`, `table`, `link`, `quote`, `image`, `codeBlock`, `inlineCode`, `codeFrame`, `codeCaption`, `codeCopy`, `lead`, `callout`, `calloutInfo`, `calloutNote`, `calloutTip`, `calloutWarning`, `calloutDanger` |
| `toc`                  | `linkActive`                                                                                                                                                                                                                                                                                 |

### `elements`

Only `text` takes `elements`, and `elements` on any other type is refused. A heading, a paragraph and a label are all `text` nodes, so `parts.root` reaches every one of them; `elements` reaches the ones drawn as one element, wherever they sit in the app.

```yaml
design:
  components:
    text:
      elements:
        h2: mt-12 tracking-tight
```

The keys are the elements a `text` can be: `p`, `span`, `h1` to `h6`, `label`, `pre`, `kbd`, `blockquote` and `code`; any other key is refused at boot, naming the ones that exist. The entry applied is the element the node is drawn as: a `text` with no `element` is drawn as a `span`, and a `text` with `format: markdown` draws an article and takes the prose parts instead. The order is: recipe, `parts.root`, `elements`, the variant, the states, the node's `classes`, `className`, the floor, so anything more specific than the element's kind still wins.

### `variants`

The variant vocabulary is per type: a `button` has seven, a `separator` has none.

```yaml
design:
  components:
    button:
      variants:
        destructive: { root: border-2 }
        ghost: { root: underline-offset-4 }
```

### `states`

**Write these without the state prefix.** Sovrium adds it.

```yaml
design:
  components:
    button:
      states:
        hover: { root: bg-neutral-800 }
        disabled: { root: opacity-40 }
```

Writing `hover: { root: 'hover:bg-neutral-800' }` is refused, for a concrete reason rather than a stylistic one: it would emit `hover:hover:bg-neutral-800`, which generates no CSS at all. You would have a valid config and no hover style. Other prefixes stay legal and are combined with the state: `md:bg-neutral-800` under `hover` becomes `hover:md:bg-neutral-800`.

`current` is the entry that points at the page being read: the current link of a sidebar, a navigation menu or a breadcrumb, which Sovrium marks with `aria-current="page"`. `states: { current: { link: bg-primary-subtle } }` restyles it without a selector.

`focus` and `focusVisible` are both in the set rather than collapsed into one, because they are different: `focus` fires when a script or a mouse moves focus; `focusVisible` only on the keyboard path.

**A state Sovrium computes rather than the browser**, such as `loading` or `pressed`, is not expressible here. Those have no CSS state to attach to; the renderer decides them. Mixing the two would mean half your entries applying through the stylesheet and half through code, with no way to tell from the config which kind you had written.

### `replace`

By default your classes are **merged over** the recipe: `p-8` beats the recipe's `p-4`, and everything you did not mention is inherited. `replace: true` drops the recipe instead. It is the escape hatch for a default that is wrong in **kind** rather than in degree. It does **not** drop the accessibility floor, and it does not drop what a component needs to work: a `sidebar` keeps its rail, its drawer and its shell layout, and `tabs` keep their `layout: fill` column. Only their look goes.

## Articles: `markdown`

`markdown` is the one key that is not a component type. It styles every markdown article in the app, a page whose `markdown` is written inline and every article of a content collection, with the shape and the parts a page's own `markdown.classes` takes: the prose parts and the regions of the reading frame. A site with several content directories, or two languages, states its article look once: `markdown: { parts: { heading2: mt-12 text-2xl } }`.

A page's own `markdown.classes` sits one layer above it. On a conflict the page wins, on that page only; a class the page does not contradict still applies.

## Legal class lists, and the ones that are not

Every leaf is validated at boot. What it refuses is narrow and deliberate: inside an arbitrary value, the constructs that would let a class list reach out of the stylesheet: `url(`, `image-set(`, `attr(`, `expression(` and `@import`.

Arbitrary values themselves stay legal (`bg-[oklch(0.7_0.1_250)]`, `text-(length:--sv-density-text)`), and so does an empty string. The rule is not "no arbitrary values"; it is "a class list styles, it does not fetch". An image belongs in `imagery`, not smuggled into a background.

## What you cannot override

One thing here is a **floor**: classes applied after yours, so the guarantee holds whatever you write. The rest are not classes at all, and could not be changed from a class list in the first place.

**The focus ring.** A `button`, an `input` and a `textarea` keep a visible `focus-visible` ring; a `link` keeps its `focus-visible` underline. `ring-0` is a legal class list and the single most damaging one you can ship, because a keyboard user loses track of where they are. So it is accepted, applied, and then overruled. Three qualifications, each worth knowing before you rely on it:

- **It covers those four types, and only the `root` part.** Nothing else carries a floor.
- **It is armed by your declaration.** An app that declares no entry for a type has no floor on it either. The floor guards against your override; where there is no override there is nothing to guard.
- **`props.className` still wins today.** The floor outranks `design.components`. A `focus-visible:ring-0` written on a single instance is a known gap, not a guarantee working as intended.

Beyond the floor: `aria-*` attributes and roles are not styling, and a class list is not the place to change what a component **is**; the names of the role tokens cannot move, because every recipe reads them (retuning a role's **value** is what `colorRoles` is for); the parts a type is made of belong to the renderer, and a name it lacks is refused; and the Sovrium element mark is a trademark.

## Ramps and role values

A palette is not a bag of hex values. It is usually a small number of **ramps** (ordered lightness ladders) plus a set of **roles** pointing into them.

<!-- sovrium:options RampSchema -->

Declare only the steps you use. A ramp step may reference another ramp's step by name.

<!-- sovrium:options ColorRoleSchema -->

A role's `value` says what it resolves to; `dark` says what it becomes under the dark scheme, and omitting it means "the same in both". A role that declares a value **defines** the token, so it does not need to already exist in `design.colors`; a role that only carries prose still documents a token declared there.

```yaml
design:
  ramps:
    neutral:
      '50': 'oklch(0.985 0 0)'
      '500': 'oklch(0.56 0 0)'
      '950': 'oklch(0.14 0 0)'
    info:
      '50': neutral-50
      '500': neutral-500
  colorRoles:
    background:
      value: neutral-50
      dark: neutral-950
      usage: The page ground. Never a fill on a control.
```

A reference that resolves to nothing is refused at boot, listing the ramps that do exist. An unresolved one would reach the browser as a variable nothing defines, and the surface would paint its initial value in silence.

**`oklch()` yes, `var()` no.** A colour value is exactly one colour: a hex literal, or one complete `rgb()`, `hsl()` or `oklch()` call with nothing after it. Anything trailing the colour, such as `rgb(0 0 0) url(…)`, is refused, because it would reach the stylesheet every page loads and could make each visitor's browser fetch a resource you never chose. Sovrium's own ramps are written in `oklch`, the only widely supported space in which a ramp can be retuned by lightness without the hue drifting underneath. `var()` and `color-mix()` are refused because they are **references**, not values: they resolve against the browser's cascade, so nothing reading your config can know what colour they name: not the contrast checker, not the token export, not an agent reading your design system. When you want a token to follow another, say so with a reference the schema understands.

## One badge for an option, everywhere

`design.badgeForm` draws every coloured option badge (the grid's status chip, a list item's `badge`, a kanban `format: badge` footer) as `filled` or `outline-dot`. `filled`, the default, paints the option colour as the chip's fill; `outline-dot` draws a transparent chip with an outline and a leading dot in the option colour. An option without a colour stays the same neutral chip on every surface, in either form.

```yaml
design:
  badgeForm: outline-dot
```
