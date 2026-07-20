# sovrium.com

**The configuration that runs [sovrium.com](https://sovrium.com)** — the marketing
site, the documentation zone, the changelog, and the apps gallery. One `app.ts`,
a `config/` tree, and markdown. No framework code, no build step, no components
to write.

This is a **source-available reference**, published so you can read a real,
production Sovrium configuration end to end. **It is not a template, and it is
not MIT-licensed.** The Sovrium name and logo are reserved trademarks.

> Synced automatically from Sovrium **v{{VERSION}}** on each deploy of sovrium.com.

## Read-only mirror

This repository is generated. Pull requests opened here will be closed unmerged —
not out of unfriendliness, but because the next sync would overwrite them.

- **Found a problem in the docs, or in Sovrium itself?** Open an issue at
  [sovrium/sovrium](https://github.com/sovrium/sovrium/issues).
- **Want a starter you can actually clone?** The 18 app templates at
  [sovrium.com/apps](https://sovrium.com/apps) are built for that, and each one
  has a "Use this template" button and a one-click deploy.

## What's here

| Path | What it is |
| --- | --- |
| `app.ts` | The whole site: pages, tables, forms, auth, analytics, LLM feeds |
| `config/pages/` | Every route, as data |
| `config/languages.ts` | The full EN/FR translation catalog |
| `config/tables/`, `config/forms/` | Newsletter + waitlist capture |
| `content/docs/{en,fr}/` | The documentation corpus, ~120 articles per locale |
| `content/changelog/` | Release notes |

## What has been removed

Three things are stripped from this mirror and are **not** part of the licence
grant below:

- `public/logos/` — customer logos are third-party trademarks. They appear on the
  live site as social proof; redistributing them here would purport to license
  marks that are not ours to license.
- `public/thomas-jeanneau.jpg` — a personal likeness, not a project asset.
- `public/schema/app.json` — a large generated artifact. The canonical copy is
  served at <https://sovrium.com/schema/app.json>.

The site therefore renders here with some missing images. That is expected.

## Running it

```bash
curl -fsSL https://sovrium.com/install | sh
sovrium start app.ts
```

For editor autocomplete and type checking against the published config types:

```bash
bun install
bunx tsc --noEmit
```

> This config tracks sovrium.com, which runs ahead of the last published release.
> If `tsc` reports errors on schema shapes the pinned `@sovrium/types` does not
> know about yet, that is expected — the runtime accepts them, and the next
> release brings the types in line.

## Licence

Business Source License 1.1 — see [LICENSE.md](LICENSE.md). Free for internal and
non-commercial use; it does not permit offering Sovrium as a hosted service to
third parties. Brand assets and trademarks are reserved separately and are not
covered by the code licence.

Commercial licensing: <license@sovrium.com>
