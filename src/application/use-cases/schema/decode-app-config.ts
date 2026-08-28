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

import { Effect, Result, Schema } from 'effect'
import { validateComputedFieldForeignKeys } from '@/application/use-cases/tables/validate-computed-field-foreign-keys'
import { AppSchema } from '@/domain/models/app'
import {
  collectDesignDeprecationNotices,
  normalizeAppDesign,
} from '@/domain/models/app/design-normalization'
import { validateComponentFieldReferences } from '@/domain/models/app/pages/components/component-field-references'
import {
  validateDataTableFieldReferences,
  validateRowColorFields,
} from '@/domain/models/app/pages/components/component-types/data/data-table/schema'
import { buildDecodeIssueReport } from '@/domain/utils/config-parsing/excess-property-report'
import type { App } from '@/domain/models/app'

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
      /**
       * Non-fatal notices about the config, currently only deprecations.
       *
       * SEPARATE from `errors` on purpose, and never merged into it: a config
       * on this branch is valid and ships. A caller that prints notices as
       * failures would turn "you may move this key" into "your deploy is
       * broken". Empty for the overwhelming majority of configs, so a caller
       * that ignores it loses nothing but the announcement.
       */
      readonly notices: readonly string[]
    }
  | {
      readonly valid: false
      readonly errors: readonly string[]
    }

const EMPTY_REF_SOURCES: ReadonlyMap<string, string> = new Map<string, string>()

/**
 * Collapse the decoder's own message into `complaint` + indented detail blocks,
 * then drop blocks that repeat one already printed.
 *
 * v4 renders one entry per failing union member, so a config rejected inside a
 * four-branch union prints the SAME complaint at the SAME path four times.
 * Nothing distinguishes the copies, so nothing is lost by keeping one — and the
 * real error stops competing with its own echo for the author's attention.
 *
 * Only this: no reordering, no suppression of DIFFERENT complaints. A message
 * the decoder produced once still reaches the author, because the failure the
 * reporter above could not explain is exactly the failure that needs its raw
 * text intact.
 */
const dedupeMessageBlocks = (message: string): readonly string[] =>
  message
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .reduce<readonly (readonly string[])[]>(
      (blocks, line) =>
        /^\s/.test(line) && blocks.length > 0
          ? [...blocks.slice(0, -1), [...(blocks.at(-1) ?? []), line]]
          : [...blocks, [line]],
      []
    )
    .filter(
      (block, index, all) =>
        all.findIndex((other) => other.join('\n') === block.join('\n')) === index
    )
    .flat()

/**
 * Turn a decode failure into lines an author can act on.
 *
 * An unrecognised property is by far the most common failure and the one the
 * decoder's own formatter reports worst. When the reporter can name it — or can
 * name the variants a rejected union accepts — its handful of lines replace the
 * blob; when it cannot, it returns nothing and the decoder's own formatter still
 * speaks, so no failure is ever swallowed.
 *
 * EFFECT 4. v3 formatted through `ParseResult.TreeFormatter.formatErrorSync`,
 * which rendered the whole schema shape as an indented tree. v4 has no
 * `TreeFormatter`: `SchemaError.message` already renders the issue with the
 * default formatter, one line plus a path. Probed side by side against v3 —
 * see `reportInput` on the decode call for the part that is NOT automatic, and
 * `excess-property-report.ts` for the union titles v4's formatter stopped
 * reading off the AST.
 */
const formatDecodeError = (
  error: Readonly<Schema.SchemaError>,
  refSources: ReadonlyMap<string, string>
): readonly string[] => {
  const reportLines = buildDecodeIssueReport(error.issue, refSources)
  return reportLines.length > 0 ? reportLines : dedupeMessageBlocks(error.message)
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
  const foreignKeys = Effect.runSync(Effect.result(validateComputedFieldForeignKeys(decoded)))
  return [
    ...(Result.isFailure(foreignKeys) ? foreignKeys.failure.split('\n') : []),
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

  // `reportInput: true` is NOT cosmetic and NOT the v4 default. Without it a
  // type failure renders as `Expected number` where v3 rendered
  // `Expected number, actual "not-a-number"` — the offending value, which is
  // the part an author acts on, silently disappears from every message
  // `sovrium validate` prints. Probed against effect@3.22.1 side by side.
  //
  // The upstream caveat is that reported input can disclose secrets or PII
  // through the message. That is acceptable HERE and only here: the input is
  // the operator's own config file and every consumer of this result prints it
  // back to that same operator (CLI stdout, the boot log, an automation run
  // they triggered). It is also exactly what v3 did. Do not copy this option to
  // a decode whose input comes from an untrusted request body.
  const decoded = Schema.decodeUnknownResult(AppSchema, {
    onExcessProperty: 'error',
    reportInput: true,
  })(parsed)
  if (Result.isFailure(decoded)) {
    return { valid: false, errors: formatDecodeError(decoded.failure, refSources) }
  }

  const semanticErrors = runSemanticChecks(decoded.success, parsed)
  if (semanticErrors.length > 0) {
    return { valid: false, errors: semanticErrors }
  }

  const { name } = parsed as Record<string, unknown>
  // `theme` and `design.theme` are the same tokens in two accepted positions
  // (the second is canonical, the first a deprecated alias). Mirroring them
  // here — at the one decode boundary every entry point shares — is what makes
  // the alias real in both directions without rewiring the ~38 modules that
  // read `app.theme`. See `design-normalization.ts` for why this is not the
  // "quiet repair" this file's header forbids.
  const app = normalizeAppDesign(decoded.success)
  return {
    valid: true,
    name: typeof name === 'string' ? name : 'unnamed',
    app,
    raw: parsed,
    notices: collectDesignDeprecationNotices(decoded.success),
  }
}
