# Component Styles

> `design.components` adds your classes to every instance of an engine component type — parts, variants and states — layered over Sovrium's recipe or replacing it, under a focus-ring floor that outranks both.

`props.className` restyles **one** component. `design.components` restyles **every instance of a type**.

The difference matters more than it sounds. Before this key, an app that wanted square corners on every button repeated the same class list at every call site — and the failure mode is not an error message. It is the one site somebody missed, found later by a customer.

```yaml
design:
  components:
    button:
      parts:
        root: rounded-none tracking-tight
```

Every button in the app, in one line.

## Where it sits in the cascade

Four layers, applied in this order — later wins a same-property conflict:

1. **Sovrium's recipe** — the shipped default for the type.
2. **`design.components`** — this key. Your app-wide answer.
3. **`props.className`** — the one instance. Beats your own app-wide rule, which is what makes a one-off override possible without an escape hatch.
4. **The floor** — a small, non-negotiable set, applied last.

## Keyed by component type, not by your component names

The keys are **engine** component types — the ones Sovrium itself draws: `button`, `table`, `dialog`, `input`, and every other type the kit ships. Your own reusable templates under the top-level `components[]` key are not styled from here; you already control those end to end, and what they carry instead is `guidance`.

**The key set is closed.** A typo — `buton:` where you meant `button:` — is refused at boot, naming the key. An open map would accept it, tell you the config is valid, and serve an app that ignored every class you wrote under it, with nothing anywhere saying so.

Two types are excluded, each for the same underlying reason — there is no Sovrium-owned element to attach a class to. `customHTML` renders markup you supply, and `command-palette` emits no visible markup on the server: a config block and its runtime, with the overlay built in the browser on the first invocation.

## What a type entry holds

<!-- sovrium:options ComponentStyleSchema -->

All four are optional, and every leaf is a Tailwind class-list string. Within one part they layer in declaration order — `parts`, then the active `variants` entry, then any matching `states` entry — so a state class is later than a variant class and wins a conflict between them.

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

Which parts a type has is Sovrium's to define — a part is an element the renderer owns — and a name that is not one of them styles nothing.

**Unlike a type key, a part name is not refused.** Part and variant names are an open set: `headr:` decodes cleanly, boots cleanly, and paints nothing. The type key can be closed because Sovrium knows every type; a part name cannot, because the parts a type owns are an implementation detail that moves with the renderer. If a block seems to do nothing, a mistyped part is the first thing to check — and the design-system console names, per part, which layer each rendered class came from.

### `variants`

The variant vocabulary is per type: a `button` has seven, a `divider` has none.

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

Writing `hover: { root: 'hover:bg-neutral-800' }` is refused, for a concrete reason rather than a stylistic one: it would emit `hover:hover:bg-neutral-800`, which generates no CSS at all. You would have a valid config and no hover style. Other prefixes stay legal and are combined with the state — `md:bg-neutral-800` under `hover` becomes `hover:md:bg-neutral-800`.

`focus` and `focusVisible` are both in the set rather than collapsed into one, because they are different: `focus` fires when a script or a mouse moves focus; `focusVisible` only on the keyboard path.

**A state Sovrium computes rather than the browser** — `loading`, `pressed` — is not expressible here. Those have no CSS state to attach to; the renderer decides them. Mixing the two would mean half your entries applying through the stylesheet and half through code, with no way to tell from the config which kind you had written.

### `replace`

By default your classes are **merged over** the recipe: `p-8` beats the recipe's `p-4`, and everything you did not mention is inherited. `replace: true` drops the recipe instead — the escape hatch for a default that is wrong in **kind** rather than in degree. It does **not** drop the accessibility floor.

## Legal class lists, and the ones that are not

Every leaf is validated at boot. What it refuses is narrow and deliberate: inside an arbitrary value, the constructs that would let a class list reach out of the stylesheet — `url(`, `image-set(`, `attr(`, `expression(` and `@import`.

Arbitrary values themselves stay legal (`bg-[oklch(0.7_0.1_250)]`, `text-(length:--sv-density-text)`), and so does an empty string. The rule is not "no arbitrary values"; it is "a class list styles, it does not fetch". An image belongs in `imagery`, not smuggled into a background.

## What you cannot override

One thing here is a **floor** — classes applied after yours, so the guarantee holds whatever you write. The rest are not classes at all, and could not be changed from a class list in the first place.

**The focus ring.** A `button`, an `input` and a `textarea` keep a visible `focus-visible` ring; a `link` keeps its `focus-visible` underline. `ring-0` is a legal class list and the single most damaging one you can ship — a keyboard user loses track of where they are — so it is accepted, applied, and then overruled. Three qualifications, each worth knowing before you rely on it:

- **It covers those four types, and only the `root` part.** Nothing else carries a floor.
- **It is armed by your declaration.** An app that declares no entry for a type has no floor on it either. The floor guards against your override; where there is no override there is nothing to guard.
- **`props.className` still wins today.** The floor outranks `design.components`. A `focus-visible:ring-0` written on a single instance is a known gap, not a guarantee working as intended.

Beyond the floor: `aria-*` attributes and roles are not styling, and a class list is not the place to change what a component **is**; the names of the role tokens cannot move, because every recipe reads them (retuning a role's **value** is what `colorRoles` is for); the parts a type is made of belong to the renderer; and the Sovrium element mark is a trademark.

**Seeing which layer won.** `GET /api/admin/design-system/provenance?type=button&part=root` returns the resolved class list with the chain that produced it — one entry per contributing layer, with the floor entry marked locked and carrying the reason. A layer that contributed nothing is omitted, so the chain's length is itself readable.

## Ramps and role values

A palette is not a bag of hex values. It is usually a small number of **ramps** — ordered lightness ladders — plus a set of **roles** pointing into them.

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

A reference that resolves to nothing is refused at boot, listing the ramps that do exist — an unresolved one would reach the browser as a variable nothing defines, and the surface would paint its initial value in silence.

**`oklch()` yes, `var()` no.** Colour values accept hex, `rgb()`, `hsl()` and `oklch()`. Sovrium's own ramps are written in `oklch`, the only widely supported space in which a ramp can be retuned by lightness without the hue drifting underneath. `var()` and `color-mix()` are refused because they are **references**, not values: they resolve against the browser's cascade, so nothing reading your config can know what colour they name — not the contrast checker, not the token export, not an agent reading your design system. When you want a token to follow another, say so with a reference the schema understands.
