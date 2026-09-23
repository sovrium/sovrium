# Console Customization

> What you can change about the built-in admin console — whether it is served at all, and how your own design paints it — plus the accessibility floor no configuration can remove.

The admin dashboard is a Sovrium app, embedded in the binary and served from yours. That makes a question inevitable, so this page answers it plainly: **you configure whether the console is served, and how it looks. Nothing else.**

**The operator does not edit the admin config; they edit only their own `design`. Any other modification is code, and therefore a fork.**

That clause is the whole boundary. Everything below is what it means in practice.

## What you configure

One key, two states:

```yaml
admin: false
```

`admin` is a **boolean**, and that is the whole of it. Omit the key, or write `admin: true`, and the console is served at `/_admin`; write `admin: false` and it is served nowhere. The path is fixed, so there is nothing to place — and anything that is not a boolean, whether an object, a path string or `null`, is refused at boot rather than silently ignored. That refusal is deliberate: a key that looked like it configured the console, and quietly did not, would be worse than no key at all.

The base path `/_admin` is not configurable either. Making it movable would turn "is this request inside the console?" into a question the public carve-out, the stylesheet cache key and the subtree collision check each had to re-answer from config — and an operator who wants the console on another address already has a reverse proxy, which is where that decision belongs.

`SOVRIUM_ADMIN=off` in the environment serves it nowhere too, which is the difference between the two: whether the console belongs to this application is an application fact and belongs in the config file, while an emergency kill switch is a deployment fact and belongs to whoever holds the environment — who may not be whoever holds the config. The environment WINS over `admin: true`, and it never fails boot for disagreeing with it.

## What you cannot rename

Nothing the console says. Its headings, its breadcrumbs, its table columns and its empty states are its own, there is no override key for them, and every deployment of a release reads them identically.

That follows from what the console is rather than from a policy laid over it. The console is an ordinary Sovrium app — written in the same declarative config surface yours is, and compiled into the binary as a preset — so the words it publishes belong to that app and not to yours. An operator who wants different words, or a different structure behind them, switches this console off and builds their own; the pieces are the config surface you already write.

## What the console looks like

**Yours, on Sovrium's floor.**

The console is **prebuilt**. It ships inside the binary, version-locked to the release, and `admin: false` turns it off so you can build your own instead. What it is never changes. What it _looks like_ is another matter: your `design` cascades into it, so the console wears your colours, your spacing, your density and your component styling — and keeps Sovrium's reference values for everything you did not declare.

**The console's default design system can be 100 % overridden. It can never be removed.** Both halves are load-bearing.

### What cascades

The keys of your `design` that cascade, each taken as you wrote it:

| Key                   | Reaches                                                                                                                                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `design`              | Your **colour roles** above all — the console's chrome paints from `background`, `foreground`, `primary` and their siblings in some 350 places. Radii, fonts and spacing follow wherever a step you named matches a utility the console uses. |
| `typeScale`           | Emitted into the console's stylesheet, so your steps are defined there. The console's own pages draw none of them today, so declaring a ladder does not yet change how the console reads.                                                     |
| `density`             | Row height, control height, gap and text size — the console's tables and lists read the ladder directly.                                                                                                                                      |
| `components`          | Your classes on every engine component the console draws.                                                                                                                                                                                     |
| `ramps`, `colorRoles` | Carried, and read today by the design-system pages rather than by the stylesheet.                                                                                                                                                             |

Everything else in `design` stays Sovrium's, and each for its own reason:

| Not cascaded                     | Why                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `zones`                          | A map from _your_ route patterns to zones. Against console paths it matches nothing, so importing it would leave the console with no zone at all. |
| `logo`                           | Identity, not a token. The console is Sovrium's; putting your mark on it would credit our product to you.                                         |
| `voice`, `principles`, `imagery` | Writing and asset guidance for the surfaces _you_ author. The console's own words are ours.                                                       |

### Where the defaults come from when you declare nothing

Not from a merge, and the distinction matters if you are reasoning about precedence. Sovrium's reference token layer is emitted into every stylesheet before anything you wrote, so an undeclared token resolves to Sovrium's value **one token at a time** — in the console exactly as on your own pages. Declaring `design.colors.primary` moves the console's primary and nothing else; every other token keeps the reference. You never have to restate a value to keep it.

### What you cannot take away

The accessibility floor. `design.components` lets you restyle an engine component type across the whole app, and `replace: true` drops Sovrium's recipe for that type outright — a legitimate thing to want, and the single most damaging class list you could write, because a button with no focus ring loses the page for a keyboard user. So the floor is applied **after** your classes, in the console and in your own app alike. You can make a console button look like anything. You cannot make it unfocusable.

That is the guarantee behind "never removed": you can replace every value, and the console still starts, still renders, and still works with a keyboard.

## What is never yours

| Not configurable      | Why                                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| The console's pages   | Its structure ships in the binary, version-locked to the release. Upgrading Sovrium upgrades the console.        |
| Its navigation        | Same. A page you cannot reach is a page that is not there.                                                       |
| Its backend           | The `/api/admin/*` routes are admin-gated reads. No config key reaches them, and none adds a write path.         |
| Its identity          | Its logo, its voice, its zone map. You restyle the console; you do not rebrand it.                               |
| Configuration editing | There is none, here or anywhere in the self-hosted product. Config is code; you change an app by editing a file. |

The last row is the one worth stating twice, because the console being written as a config file makes the temptation structural rather than hypothetical. It does not make configuration editable. A visual config-editing plane exists — it is part of hosted Sovrium Cloud, and it is deliberately not in the binary you self-host.

## Which pages the console serves

The console drops pages your instance has no use for. An **API keys** page on an instance where `auth.apiKeys` is off is a nav entry leading somewhere empty, so it is not served at all: it `404`s and appears in no listing.

That is the one way your config changes the console's _shape_, and it works in one direction only — a page can be absent because a capability is, never present because you asked for it.

## The mount owns its whole subtree

`/_admin` answers `/_admin` and every `/_admin/**` path. An operator page, form or redirect underneath it is a NAMED boot failure rather than a silently shadowed route, because shadowing quietly is the worse failure: you would ship a page that never renders, or displace part of the console you need in order to diagnose it.

## Restyling the console itself

Only by working in the Sovrium repository, on the release rather than on an instance — which is exactly what "any other modification is code, and therefore a fork" means.

The console is `src/admin/`, and its design is `src/admin/config/design.ts`. Contributors preview it with:

```bash
bun run app:admin
```

That boots the console standalone with hot reload, so a token edit is visible on the next save. One detail worth knowing before you conclude something is broken: it boots `src/admin/preview.ts` rather than `src/admin/app.ts`, because `app.ts` deliberately declares no `auth` block and a console nobody can sign into answers `404` on every data page. The preview adds that one block, so sign in at `/login` with the `AUTH_ADMIN_*` credentials from `src/admin/.env.example`.

## Related reading

- **Admin Dashboard** — the console itself, its surfaces and its read API.
- **Design System Console** — the console section that documents your system at its rendered values.
- **Design System** — the `design` key that governs your own pages.
- **Component Styles** — restyling an engine component type across your app.
- **Density** — the row, control, gap and text ladder.
- **Environment Variables** — `SOVRIUM_ADMIN` and its siblings.
