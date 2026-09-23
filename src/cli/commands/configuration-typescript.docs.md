# TypeScript Configs

> The same configuration object as a TypeScript module — checked in your editor as you type, with no npm, no `package.json` and no install step.

The CLI takes `app.ts` everywhere it takes `app.yaml`. The difference is entirely in your editor, where every property, field type and component type is checked as you write it. The types ship inside the binary, and one command writes them next to your config.

## Setting it up

Run `sovrium types` in the directory holding your config. Two files land, and **both are needed**.

| File            | What it does                                                | On re-run         |
| --------------- | ----------------------------------------------------------- | ----------------- |
| `sovrium.d.ts`  | Declares the bare `sovrium` module your config imports from | Always rewritten  |
| `tsconfig.json` | Puts that declaration into the TypeScript program           | Written if absent |

The declaration on its own is inert: with no `tsconfig.json`, the compiler never pulls it into the program and every config fails with `Cannot find module 'sovrium'`.

```typescript
import type { AppConfig } from 'sovrium'

export default {
  name: 'my-app',
  version: '1.0.0',
  description: 'A simple todo list',
  tables: [
    {
      id: 1,
      name: 'tasks',
      fields: [
        { id: 1, name: 'title', type: 'single-line-text', required: true },
        { id: 2, name: 'done', type: 'checkbox', default: false },
      ],
    },
  ],
} satisfies AppConfig
```

Run it with the same commands as any other format. To get all three files at once, scaffold with `sovrium init --typescript`, which writes the config, the declaration and the compiler config together so a fresh directory type-checks and validates on the first try.

**`app.yaml` shadows `app.ts`.** When the CLI discovers a config on its own it resolves the YAML name first, so a directory holding both runs the one you were not editing. Keep one config file per project, or pass the path explicitly.

## Why the import is type-only

Neither `import type` nor `satisfies` is a style preference here.

**`import type` is erased before the binary looks.** Bare-package specifiers are left unresolved, so a _value_ imported from `sovrium` would have nothing to resolve to at boot. A type-only import disappears at transpile time, so the specifier is never resolved at all — and that is precisely what makes a typed config work with nothing installed.

**The declaration exports types and never a value**, which makes the mistake unreachable rather than merely discouraged. A helper function living in that file would type-check clean and then refuse to boot, which is the worst shape a failure can take: the compiler exits 0, the config ships, and the error arrives at start-up. With no values to import, a value import fails in your editor for the ordinary reason that no such export exists.

**`satisfies` beats an annotation.** It checks the literal against the type without widening it, so the export keeps its precise shape and a misspelled property is still an excess-property error. Annotating with `: AppConfig` would widen the literal and lose exactly that.

## Composing with imports

TypeScript already has the mechanism `$ref` provides for YAML. The declaration exports a type per section, so split the config into modules and assemble them:

```typescript
import type { TableConfig } from 'sovrium'

export const companies: TableConfig = {
  id: 1,
  name: 'Companies',
  fields: [
    { id: 1, name: 'name', type: 'single-line-text', required: true },
    { id: 2, name: 'website', type: 'url' },
  ],
}
```

```typescript
import type { AppConfig } from 'sovrium'
import { companies } from './config/tables'

export default {
  name: 'crm-workspace',
  tables: [companies],
} satisfies AppConfig
```

`TableConfig`, `PageConfig`, `AuthConfig`, `ThemeConfig` and the other section types all come from the same declaration. And because the config is a real module it can be _computed_: read a value from the environment, generate a table per entity, derive routes from a list.

## After upgrading the binary

Re-run `sovrium types`. The declaration describes the schema of the binary that wrote it, so a stale one quietly disagrees with the engine you are now running — and rewriting it on every run is what makes that skew impossible to reach.

Your `tsconfig.json` is left alone, because by then it is yours: paths, JSX, stricter compiler flags. One thing has to stay true of it, and the command says so when it declines to touch it — the declaration must remain in the TypeScript program, which it is unless an `include` or `files` entry narrows the default glob past it.

## Choosing between the two

| Choose TypeScript when                                     | Choose YAML when                                 |
| ---------------------------------------------------------- | ------------------------------------------------ |
| The config is large enough that typos cost debugging time  | It is small, and read more often than edited     |
| Sections repeat and you would rather generate than copy    | Non-developers need to read or amend it          |
| Values come from the environment or another source         | The file should obviously be data, not code      |
| You want errors in the editor rather than at validate time | Nobody editing it runs a TypeScript-aware editor |

Both describe the same object, so this is not a one-way door: a YAML config transcribes to TypeScript by hand, and the reverse.
