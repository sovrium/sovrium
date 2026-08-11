/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * THE config-decode pipeline. One process, one home.
 *
 *   AppSchema decode → post-decode semantic checks
 *
 * Every entry point that reads a config file runs exactly this:
 *   - `sovrium validate` (`src/cli/commands/validate.ts`, both the interactive
 *     command and the progress pipeline's sweep)
 *   - `sovrium start`    (`src/index.ts` → `start-server.ts`)
 *   - `sovrium build`    (`src/index.ts`)
 *   - the `data:validate-config` automation action (GAP-J2)
 *
 * WHY THIS FILE EXISTS. The four decoders that preceded it disagreed with each
 * other. One skipped the boot-time cross-field checks, so a config with an
 * unresolvable `count` / `rollup` foreign key validated clean and then refused
 * to boot — a green deploy gate on a dead deployment. Routing all of them
 * through here is what makes the promise "if `validate` passes, `start` will
 * not reject your config" true rather than aspirational.
 *
 * SEVERITY. Every finding is FATAL: a config is either understood or refused,
 * never quietly repaired and never silently stripped. There is no `warn` class
 * — a rewriting pre-pass used to absorb legacy spellings and report them as
 * deprecations, and it was removed with the spellings themselves, because a
 * product should not carry translation layers between its own releases.
 *
 * IMPORT-LIGHT BY CONTRACT. `validate.ts` lazily imports this module
 * specifically to keep the compiled-binary `validate` path domain-only —
 * pulling native CSS modules in breaks the binary in a way local tests do not
 * show. Everything imported here is pure TypeScript; keep it that way.
 */

import { Effect, Either, Schema } from 'effect'
import { TreeFormatter } from 'effect/ParseResult'
import { validateComputedFieldForeignKeys } from '@/application/use-cases/tables/validate-computed-field-foreign-keys'
import { AppSchema } from '@/domain/models/app'
import { validateComponentFieldReferences } from '@/domain/models/app/pages/components/component-field-references'
import {
  validateDataTableFieldReferences,
  validateRowColorFields,
} from '@/domain/models/app/pages/components/component-types/data/data-table/schema'
import { buildExcessPropertyReport } from '@/domain/utils/config-parsing/excess-property-report'
import type { App } from '@/domain/models/app'
import type { ParseError } from 'effect/ParseResult'

/**
 * Options every entry point may pass.
 *
 * There is deliberately no excess-property knob. `'error'` is THE contract —
 * Sovrium never ignores what an author wrote — and it applies to `validate`,
 * `start` and `build` alike. An `'ignore'` escape existed while boot still
 * stripped unrecognised properties; the moment it was closed the option became
 * a way to re-open the hole one call site at a time, so it went with it.
 * @public
 */
export interface DecodeAppConfigOptions {
  /** `$ref` source map, so an unrecognised property can name the partial it came from. */
  readonly refSources?: ReadonlyMap<string, string>
}

/**
 * Result of running a parsed config through the pipeline.
 * @public
 */
export type DecodeAppConfigResult =
  | {
      readonly valid: true
      readonly name: string
      /** The decoded config — what the server actually runs. */
      readonly app: App
      /** The RAW config as parsed — what downstream re-decoders must be handed. */
      readonly raw: unknown
    }
  | {
      readonly valid: false
      readonly errors: readonly string[]
    }

const EMPTY_REF_SOURCES: ReadonlyMap<string, string> = new Map<string, string>()

/**
 * Turn a decode failure into lines an author can act on.
 *
 * An unrecognised property is by far the most common failure and the one
 * `TreeFormatter` reports worst (67 lines of union traversal, the offending
 * name on line 52, no path at all). When the reporter can name it, its four
 * lines replace the blob; when it cannot — a missing required field, a bad
 * value — it returns nothing and the decoder's own formatter still speaks, so
 * no failure is ever swallowed.
 */
const formatDecodeError = (
  error: Readonly<ParseError>,
  refSources: ReadonlyMap<string, string>
): readonly string[] => {
  const excessLines = buildExcessPropertyReport(error.issue, refSources)
  return excessLines.length > 0
    ? excessLines
    : TreeFormatter.formatErrorSync(error)
        .split('\n')
        .filter((line) => line.trim().length > 0)
}

/**
 * The cross-field rules the per-property decode cannot express.
 *
 * A pure Effect, run here rather than composed, because this pipeline is
 * synchronous by design: its callers are a CLI command, a build function and an
 * automation action, none of which want an Effect just to read a config.
 *
 * WHAT USED TO BE HERE. A second check, `validateTriggerConfigs`, held nine
 * hand-maintained per-trigger allow-lists whose own JSDoc asked to be kept in
 * sync with the schemas by hand. It existed only because the decoder stripped
 * unknown properties silently, so a typo on a trigger had to be caught before
 * the decode or not at all. With `onExcessProperty: 'error'` the decoder
 * catches the same key AND names its path — read off the AST, so it cannot
 * drift — which is strictly the better message from a source that maintains
 * itself. The one thing lost is verbosity: the allow-lists reported every
 * unknown key on a trigger, while Effect decodes with `errors: 'first'` and
 * names one per run. Equivalent as a gate; the author fixes several typos one
 * run at a time.
 *
 * WHY THE THREE FIELD-REFERENCE SWEEPS RUN HERE AND NOT ONLY IN THE CLI.
 * They used to sit in `sovrium validate`'s `runPostDecodeChecks`, which made
 * `validate` STRICTER THAN BOOT on three authoring rules — the last place the
 * published promise "validate and start run the same validation" was not
 * literally true. The argument for keeping them out was that they are
 * "pre-flight authoring checks, not a new way for a running app to refuse to
 * start". What that framing missed is that a running app which cannot resolve
 * the field it was told to render does not degrade gracefully — it ships the
 * mistake as a surface that LOOKS deliberate. `views: ['kanban']` with no
 * `kanbanGroupBy` renders a dead tab; a `rowColorField` naming a field that does
 * not exist paints nothing in exactly the way a correct grid paints nothing for
 * an undeclared colour. Neither is distinguishable at runtime from the config
 * the author meant to write, so "no warning" is not the safe option — it is the
 * option that hides the defect from the only person who can fix it.
 *
 * They clear the bar the decode draws around itself: every verdict is derived
 * from the config's own `tables[].fields[]` — not from a hand-maintained mirror
 * of what the decoder accepts — and is statically decidable and deterministic,
 * touching no environment, filesystem or database. The registries they consult
 * (`COMPONENT_FIELD_REFERENCE_PATHS`) can only ever UNDER-report: a path that
 * names nothing resolves to nothing, so drift there loses coverage rather than
 * inventing a refusal.
 *
 * THE UNKNOWN-FIELD-TYPE SWEEP DELIBERATELY DID NOT COME WITH THEM. It stays in
 * `validate.ts` — see `runPostDecodeChecks` there for the reason, which is not
 * the one its comment used to give.
 */
const runSemanticChecks = (decoded: App, normalized: unknown): readonly string[] => {
  const foreignKeys = Effect.runSync(Effect.either(validateComputedFieldForeignKeys(decoded)))
  return [
    ...(Either.isLeft(foreignKeys) ? foreignKeys.left.split('\n') : []),
    ...validateDataTableFieldReferences(normalized),
    ...validateComponentFieldReferences(normalized),
    ...validateRowColorFields(normalized),
  ]
}

/**
 * Run an already-parsed config OBJECT through the full pipeline.
 *
 * Never throws, never touches the filesystem, never exits the process.
 *
 * ONE sweep stays outside: the unknown-FIELD-TYPE check in `validate.ts`'s
 * `runPostDecodeChecks`. Boot already refuses an unrecognised `type` — at DDL
 * generation, inside the migration transaction — and three migration specs
 * assert both that message and the rollback it triggers. See that function.
 *
 * @param parsed - Config object as parsed from JSON / YAML / TypeScript
 * @param options - `$ref` sources for error attribution
 */
export const decodeAppConfigObject = (
  parsed: unknown,
  options: DecodeAppConfigOptions = {}
): DecodeAppConfigResult => {
  const { refSources = EMPTY_REF_SOURCES } = options

  const decoded = Schema.decodeUnknownEither(AppSchema, { onExcessProperty: 'error' })(parsed)
  if (Either.isLeft(decoded)) {
    return { valid: false, errors: formatDecodeError(decoded.left, refSources) }
  }

  const semanticErrors = runSemanticChecks(decoded.right, parsed)
  if (semanticErrors.length > 0) {
    return { valid: false, errors: semanticErrors }
  }

  const { name } = parsed as Record<string, unknown>
  return {
    valid: true,
    name: typeof name === 'string' ? name : 'unnamed',
    app: decoded.right,
    raw: parsed,
  }
}
