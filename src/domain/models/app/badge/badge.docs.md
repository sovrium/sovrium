# Built with Sovrium Badge

> The `badge` root property: the small "Built with Sovrium" link every page carries by default, where it sits, and the one line that removes it.

Every page of a Sovrium app carries a small **"Built with Sovrium"** link pill, shown by default. `badge` is the one property that controls it: leave it out to keep the default, move it into a footer line when it covers your content, or remove it with `badge: false`.

```yaml
name: my-app
badge: false # removes the badge: one line, free, forever
```

## Configuration

`badge` takes a boolean or an object. `true` and an empty object both behave like the default.

<!-- sovrium:options BadgeSchema -->

| Value                   | Behaviour                                                 |
| ----------------------- | --------------------------------------------------------- |
| (omitted)               | Badge shown: the default.                                 |
| `true`                  | Badge shown, explicitly.                                  |
| `false`                 | Badge removed from every page.                            |
| `{ placement: footer }` | Badge shown as a line in a footer after the page content. |

An unknown `placement` is refused at startup, and `sovrium validate` names the `placement` property rather than the whole `badge` value.

## Placement

By default the badge floats: it is pinned to the bottom-right corner of the window, over the page. On pages whose last row holds content, such as a submit button or a table's pager, use `placement: footer` instead. The badge then renders as a static line after the page's main content. It is a plain line, not a second footer, so a page that draws its own footer still has one, and it never covers anything.

```yaml
badge:
  placement: footer # a footer line instead of a floating pill
```

On a page laid out as a window-high shell (a row exactly one window high, its overflow hidden with `h-screen overflow-hidden`, holding a sidebar beside an inset that scrolls on its own with `overflow-y-auto`), the footer closes that inset instead. It is the inset's last line, reached by scrolling the inset to its end, and the page itself never grows a second scroll below the shell. The same holds when the shell is a component template placed with `$ref` and the page's content goes into its `$children` slot.

`placement: floating` is the default and matches `badge: true`. A toast on a page with a floating badge rises above the badge instead of covering it, and keeps its place near the bottom edge when there is no badge.

## What it is, and what it is not

The badge is server-rendered chrome with **zero telemetry**: a single static `<a>` linking to the project site, with no beacon, no pixel and no client-side JavaScript. Its label follows the page's active locale, and the text itself is not customisable. It stays legible in the dark theme.

It appears on app pages, the default homepage, error pages and standalone form pages. It is always absent from the operator console and from embedded form variants, whatever the config says.

**Removing it is one line, it applies everywhere, and it will stay free.** It is never licence-gated. Keeping the badge is a way to support the project.

## Related reading

- **App Metadata**: the other identity properties at the root of the config: `name`, `displayName`, `version` and `description`.
- **Reusable Components**: templates, `$ref` and the `$children` slot a page shell is written with.
