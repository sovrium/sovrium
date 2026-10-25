# The four customisation keys

Four keys decide what a component looks like. Picking the right one is most of the skill: the wrong layer works today and drifts tomorrow.

## Contents

- [The cascade](#the-cascade)
- [Choosing the layer](#choosing-the-layer)
- [design.components: every instance of a type](#designcomponents-every-instance-of-a-type)
- [classes: the parts of one instance](#classes-the-parts-of-one-instance)
- [props.className: one root](#propsclassname-one-root)
- [The focus floor](#the-focus-floor)
- [What a class list may not hold](#what-a-class-list-may-not-hold)
- [When a style does nothing](#when-a-style-does-nothing)

## The cascade

```
recipe  <  design.components  <  classes  <  props.className  <  focus floor
```

Later wins a conflict on the same property. Everything you did not mention is inherited from the layer below. Manual: `sovrium docs theming/design-components`.

## Choosing the layer

| You want                                             | Write it in                | Example                                     |
| ---------------------------------------------------- | -------------------------- | ------------------------------------------- |
| A colour, size or font the whole app uses            | `design` (a token)         | `design.colors.coral`                       |
| Every button, table or sidebar to look a certain way | `design.components.<type>` | `button: { parts: { root: rounded-none } }` |
| The inner parts of one placed component to differ    | that component's `classes` | the links of one sidebar                    |
| One placed component's root to differ                | its `props.className`      | one wider card                              |

Default to the highest layer that is true: a rule true for every button is a `design.components` rule, even if only three buttons exist today.

## design.components: every instance of a type

Keys are **engine** component types — `button`, `table`, `dialog`, `input`, `sidebar` and every other type the kit ships — never the names of your own reusable `components` templates, which you already style end to end. The key set is closed, so a typo is refused at boot. `customHTML` and `command` take no entry: there is no element of Sovrium's to attach a class to.

An entry holds four optional members, every leaf a class-list string:

| Member     | What it styles                                                                                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parts`    | Each named element of the type: every type has `root`; a composite one names more (a table's `header`, `row`, `cell`; a sidebar's `inner`, `nav`, `link`, `groupLabel`, `badge`) |
| `variants` | Per-part classes for one named variant (a `button` has its own set; a `separator` has none)                                                                                      |
| `states`   | Per-part classes in one interaction state: `hover`, `focus`, `focusVisible`, `active`, `disabled`, `open`, `selected`, `checked`, `invalid`, `current`                           |
| `replace`  | `true` drops the recipe instead of layering over it                                                                                                                              |

Within one part the layers apply in order — `parts`, then the active variant, then a matching state — so a state class wins over a variant class.

```yaml
design:
  colors:
    coral: '#ff6f59'
    coral-strong: '#e2523d'
  components:
    button:
      parts:
        root: rounded-none
      variants:
        default: { root: bg-coral text-white }
      states:
        hover: { root: bg-coral-strong }
    sidebar:
      states:
        current: { link: bg-coral text-white }
```

- **States are written without their prefix.** `hover: { root: bg-coral-strong }`, never `hover:bg-…` inside it: the doubled prefix generates no CSS, so it is refused. Other prefixes combine: `md:bg-x` under `hover` becomes `hover:md:bg-x`.
- **`current`** is the entry pointing at the page being read — a sidebar link, a navigation menu item, a breadcrumb — which Sovrium marks with `aria-current="page"`. It replaces any descendant selector on that attribute.
- **`loading` and `pressed` are not states here**: the renderer decides them, so no CSS state exists to attach to.
- **`replace: true`** is the escape hatch for a default that is wrong in kind. It keeps the focus floor and what the component needs to work (a sidebar keeps its rail and drawer; tabs keep their layout); only the look goes.
- **The part names of a type** are listed in its category article: `sovrium docs components/<category>-components`, or `sovrium docs components/sidebar-navigation` for the sidebar.

## classes: the parts of one instance

`classes` takes the same shape — `parts`, `variants`, `states` — on one placed component, layered over the app-wide entry for its type and under its own `props.className`. A reusable template can carry `classes` too, and every placement inherits them; a placement's own `classes` layer over the template's.

```yaml
components:
  - type: sidebar
    classes:
      parts:
        link: h-8 rounded-md px-2.5 text-muted-foreground
      states:
        current: { link: bg-primary-subtle font-medium }
```

Use it when one instance departs from the app's look; when every instance should, move the block to `design.components`.

## props.className: one root

`props.className` reaches the root of one instance and nothing inside it. It is the right place for a layout decision on that node (`grid md:grid-cols-2`, `py-section`) and the wrong place for a brand decision repeated across instances.

## The focus floor

A `button`, an `input` and a `textarea` keep a visible `focus-visible` ring and a `link` its `focus-visible` underline, applied after your classes. Three limits:

- It covers those four types, on their `root` part only.
- It is armed by your declaration: a type with no `design.components` entry has no floor, because there is no override to guard against.
- `props.className` still wins over it today, so a `focus-visible:ring-0` written on one instance removes the ring.

Never write a class that hides focus, on any layer. Keyboard users lose their place. [S8]

## What a class list may not hold

Every leaf is validated at boot. Arbitrary values stay legal (`bg-[oklch(0.7_0.1_250)]`) and so does an empty string; what is refused is a construct that reaches out of the stylesheet inside an arbitrary value — `url(`, `image-set(`, `attr(`, `expression(`, `@import`. An image belongs in `imagery` or a component, never smuggled into a background.

Beyond class lists: `aria-*` attributes and roles are not styling; the role token names every recipe reads cannot move (retune a role's value with `colorRoles` instead); the parts a type is made of belong to the renderer.

## When a style does nothing

1. **Part name**: part and variant names are an open set, so `headr:` decodes, boots and paints nothing. Compare with the category article.
2. **Layer**: a later layer may override it — an instance's `classes` or `props.className`.
3. **Origin**: `/_admin/design-system` names, per part of a declared component, which layer each rendered class came from.
4. **Token**: a utility for a token that does not exist (`bg-coral` with no `colors.coral`) paints nothing.
