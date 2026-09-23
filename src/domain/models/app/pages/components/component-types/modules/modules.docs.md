# Shared Component Modules

> The nine cross-cutting property modules every component type composes from — what each one means, which types carry it, and where its options are listed.

Component types do not each invent their own vocabulary. A small set of shared modules is spread into the types that opt into them, so `visibility` means the same thing on a `button` as on a `kanban`, and learning it once is enough.

```yaml
- type: table
  props: { className: 'rounded-lg' }
  dataSource: { table: invoices }
  visibility: { roles: [admin, finance] }
  responsive: { md: { props: { className: 'text-sm' } } }
```

| Module         | Present on                 | What it does                                                                                     |
| -------------- | -------------------------- | ------------------------------------------------------------------------------------------------ |
| `props`        | Every component            | Key-value bag rendered as HTML attributes — `className`, `variant`, and component-specific keys. |
| `children`     | Container components       | Nested component definitions, or plain strings. Arbitrary depth.                                 |
| `content`      | Content and layout         | Inline text or markdown, with reference substitution.                                            |
| `dataSource`   | Sixteen data-bound types   | Binds to a table or to a system read endpoint. Listed per type, not subtracted — see below.      |
| `visibility`   | Most components            | Whether the component is rendered at all — by session, role, capability, record or URL state.    |
| `responsive`   | Most components            | Per-breakpoint property overrides.                                                               |
| `interactions` | Interactive components     | Click, hover, scroll and entrance behaviour.                                                     |
| `action`       | Form and button components | What running the component does — `crud`, `auth`, `navigate`, `automation`, `fetch`.             |
| `i18n`         | Content components         | Per-language content variants.                                                                   |

`props` and `children` are the two universals. The rest are opt-in, and a type's own reference page is where you find out which of them it accepts.

**Seven of these modules never appear in a per-type option table**: `props` and `children` together, `content`, `visibility`, `responsive`, `interactions`, `action` and `i18n`. A table lists what the type declares for itself, and those are subtracted before it is drawn. Printing them would add roughly a hundred and ninety rows to every one of the ninety types and bury the handful that are actually about that type — `button` has thirteen options of its own and two hundred and six once the modules are counted in.

**`dataSource` is the exception, and deliberately so.** It is not subtracted, so it appears in full in the own table of each of the sixteen types that accept one — `calendar`, `chart`, `container`, `drawer`, `form`, `gallery`, `graph`, `kanban`, `kpi`, `list`, `matrix`, `record-field`, `record-picker`, `select`, `table` and `timeline`. Those types do not all mean the same thing by it — a `kpi` reads one aggregate where a `table` reads a page of rows — so the per-type description is worth the repetition, and the section below covers only what they have in common.

## `props`

An open bag. A key may hold a string, a number, a boolean, an object or an array, and a key present with no value is refused rather than ignored. Because it is open, it has no option table: what a given key means is decided by the type that reads it, and is documented on that type's page.

`className` is the one key every type reads the same way — Tailwind classes appended after the component's own prestyle, so they win the cascade.

## `content`

Inline text, or a structured object for the types that take one. A string is the common case; an object is how a type carries several named slots (`{ button: { text, animation } }`). Values resolve the reference families below.

## `visibility`

Whether the component is rendered at all. Every gate is evaluated server-side: a component that fails one is omitted from the HTML entirely rather than hidden with CSS, so its content never reaches a reader who should not have it.

<!-- sovrium:options VisibilitySchema -->

The `unless…` keys are the negations of their siblings — `unlessDeclares` renders only where the app does NOT declare the capability, `unlessRuntime` only where it cannot run here. They exist so that an alternating body can carry both halves in one page: the catalogue where automations are declared, the honest empty state where they are not. Naming the same capability in both halves is refused when the config is decoded, because the component could then render nowhere.

`declares` asks what the app being served declares; `runtime` asks whether that declaration can actually run on this deployment. On a host declaring an agent with no AI provider configured, `declares: agents` renders and `runtime: ai` does not.

## `dataSource`

Binds a component to rows. Either a database table or a system read endpoint — the full option list, the filter and sort vocabulary and the reference families live in Data Binding.

The two data-bound extras that ride with it are documented here, because no other page owns them.

### `autoSave`

<!-- sovrium:options AutoSaveConfigSchema -->

### `search`

<!-- sovrium:options ComponentSearchSchema -->

## `responsive`, `interactions` and `action`

`responsive` overrides properties per breakpoint; `interactions` declares click, hover, scroll and entrance behaviour; `action` declares what running a control does. All three are large enough to have their own reference pages — see Responsive Design, Interactions, and the action families under Interactivity.

## `i18n`

Per-language variants of a component's content. An open map keyed by language code, so it carries no option table: the keys are the languages the app declares.

## Reference substitution

`content` and `props` values resolve four reference families at render time:

- `$record.<field>` — the bound record, on a component with a record-binding ancestor.
- `$vars.<key>` — page variables.
- `$currentUser.<path>` — session context.
- `$t:<key>` — a translation key from the app's language files.

A page rendered from markdown adds `$frontmatter.*`. What each one resolves to, and what happens when it resolves to nothing, is in Data Binding.
