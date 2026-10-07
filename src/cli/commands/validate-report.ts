/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolve } from 'node:path'
import { Effect, Console } from 'effect'
import {
  formatConfigCandidatesLine,
  formatDiscoveredConfigNotice,
} from '@/domain/kernel/config-parsing/default-config-files'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { lazyImportSchema } from './utils'
import type { ConfigFinding } from '@/domain/models/app/app-excess-property-report'

/** The part of a validation outcome the `--json` document publishes. */
interface JsonReportOutcome {
  readonly valid: boolean
  readonly findings: readonly ConfigFinding[]
  readonly notices: readonly string[]
}

/**
 * Resolve the config to validate when the operator named none.
 *
 * `validate` has no env-var source, so its order is simply positional →
 * discovery → refusal. Everything downstream is untouched: a discovered file
 * travels the same `loadConfigForValidationWithSources` path a named one does,
 * so it fails identically when it is broken.
 */
export const discoverValidationConfig = async (): Promise<string> => {
  const { discoverDefaultConfigFile } = await lazyImportSchema()
  const discovered = await discoverDefaultConfigFile(process.cwd())

  if (!discovered) {
    printStderr(
      `Error: No config file provided.\n\n` +
        `${formatConfigCandidatesLine(process.cwd())}\n\n` +
        `Usage:\n  sovrium validate <config.json|config.yaml>\n\n` +
        `Run 'sovrium init' to scaffold a new project.`
    )
    process.exit(1)
  }

  printStderr(formatDiscoveredConfigNotice(discovered))
  return discovered
}

/**
 * Every file the verdict actually covered: the root, plus each `$ref` partial it
 * pulled in.
 *
 * Information the caller could not otherwise compute. A supervisor that wants to
 * re-validate when the config changes has no way to learn what the root reached
 * without resolving the graph itself, and a one-file config makes the field look
 * redundant precisely because it is the shape where it carries nothing.
 */
export const coveredFiles = (
  rootPath: string,
  refSources: ReadonlyMap<string, string>
): readonly string[] => [...new Set([resolve(rootPath), ...refSources.values()])]

/**
 * Write the verdict as ONE JSON document on stdout, and nothing else.
 *
 * "Nothing else" is the whole promise, not a preference. The caller is a program
 * running this command and parsing what comes back; one stray human-readable
 * line — a success banner, a discovered-config notice, a deprecation — and its
 * `JSON.parse` throws for a reason that has nothing to do with the config it
 * asked about. Everything conversational already prints on stderr, and this is
 * why that discipline has to hold.
 *
 * `findings` and `notices` stay two fields for the same reason `errors` and
 * `notices` are two fields in prose mode: a notice is not a refusal, and a
 * deploy gate that treats findings as failures must not fail on a working
 * config. The exit code is unchanged by the flag — a verdict that reported
 * differently depending on how it was asked would be two verdicts.
 */
export const printJsonReport = (outcome: JsonReportOutcome, files: readonly string[]): void => {
  Effect.runSync(
    Console.log(
      JSON.stringify({
        valid: outcome.valid,
        files,
        findings: outcome.findings,
        notices: outcome.notices,
      })
    )
  )
  if (!outcome.valid) {
    process.exit(1)
  }
}
