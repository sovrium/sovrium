/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { Console, Effect } from 'effect'
import { isHeadless, openInBrowser } from '@/cli/runtime/browser-launch'
import { readValueFlag } from '@/cli/runtime/flag-vocabulary'
import { OPERATOR_FIX_GUIDANCE } from '@/domain/errors/operator-fixable-error'
import { serverFailureReportUrl } from '@/domain/kernel/url/issue-report-address'
import {
  bugReportFields,
  redactEnvDefaults,
  redactValues,
  scrubReportText,
  secretEnvDefaultsOf,
  secretEnvValues,
} from '@/domain/kernel/url/issue-report-failure'
import { SECURITY_ADVISORY_URL, buildIssueReportUrl } from '@/domain/kernel/url/issue-report-url'
import { printFailure, printStderr } from '@/infrastructure/logging/cli-output'
import { readIssueReportFacts, readReportScrub } from '@/infrastructure/logging/issue-report-facts'
import { findServerFailure, readLastCliFailure } from '@/infrastructure/logging/issue-report-store'
import { lazyImportSchema } from './utils'

/**
 * `sovrium report` — print the address of a new issue, prefilled.
 *
 * The command builds a string and prints it: it submits nothing and makes no
 * network request. stdout carries the address alone, on one line, so
 * `$(sovrium report)` works; everything meant for a person goes to stderr.
 *
 * - no flag: the bug form, with the installation facts and whether the
 *   project's configuration validates — and no address at all when it does
 *   not, since a configuration error is the author's to fix, not a bug;
 * - `--config <path>`: the same, with that file attached, redacted;
 * - `--feature <kind>`: one of the three feature forms, empty;
 * - `--security`: the private advisory form, bare, whatever else is asked;
 * - `--last-error`: the report the last failure printed, again;
 * - `--request-id <id>`: the report of a server error this project kept — or,
 *   for one the operator can fix, that fix and no address;
 * - `--open`: also hand the address to the browser.
 */

/** The three feature forms, by the `--feature` kind that selects each. */
const FEATURE_FORMS = {
  'config-option': 'feature-config-option.yml',
  'engine-primitive': 'feature-engine-primitive.yml',
  recipe: 'feature-recipe.yml',
} as const

type FeatureKind = keyof typeof FEATURE_FORMS

const isFeatureKind = (kind: string): kind is FeatureKind => Object.hasOwn(FEATURE_FORMS, kind)

/** Print the address, open it when asked, and stop. */
const answer = (url: string, argv: readonly string[]): void => {
  Effect.runSync(Console.log(url))
  if (argv.includes('--open') && !isHeadless()) openInBrowser(url)
}

const refuse = (headline: string, guidance: string): never => {
  printFailure({ headline, guidance })
  // Terminate process - imperative statement required for CLI
  process.exit(1)
}

/** `--security`: the advisory form, bare. Nothing else is attached, ever. */
const reportVulnerability = (argv: readonly string[]): void => {
  const attachable = ['--config', '--last-error', '--request-id', '--feature']
  if (attachable.some((flag) => argv.some((arg) => arg === flag || arg.startsWith(`${flag}=`)))) {
    printStderr(
      'A vulnerability is reported privately, and you write the report yourself, so --security attached nothing.'
    )
  }
  answer(SECURITY_ADVISORY_URL, argv)
}

const reportFeature = (kind: string | undefined, argv: readonly string[]): void => {
  const kinds = Object.keys(FEATURE_FORMS).join(', ')
  if (kind === undefined || !isFeatureKind(kind)) {
    refuse(
      kind === undefined
        ? '--feature needs a kind of idea. No address was printed.'
        : `"${kind}" is not a kind of idea Sovrium has a form for. No address was printed.`,
      `Give --feature one of: ${kinds}.`
    )
    return
  }
  answer(buildIssueReportUrl({ form: FEATURE_FORMS[kind], title: '' }), argv)
}

const reportLastError = (argv: readonly string[]): void => {
  const kept = readLastCliFailure()
  if (kept === undefined) {
    refuse(
      'No failure is kept for this project. No address was printed.',
      'A failed start, build or command keeps its report here; run `sovrium report` to report another problem.'
    )
    return
  }
  answer(kept.url, argv)
}

const reportServerError = (requestId: string | undefined, argv: readonly string[]): void => {
  if (requestId === undefined) {
    refuse(
      '--request-id needs the id of a request. No address was printed.',
      'Give it the requestId a server error answered with.'
    )
    return
  }
  const kept = findServerFailure(requestId)
  if (kept === undefined) {
    refuse(
      `No server error is kept under request id "${requestId}". No address was printed.`,
      'Run this where that server runs, with the same data directory: the server keeps the errors it answered there.'
    )
    return
  }
  if (kept.fix !== undefined) {
    refuse(
      `The server error kept under request id "${requestId}" is yours to fix, not a bug in Sovrium. No address was printed.`,
      OPERATOR_FIX_GUIDANCE[kept.fix]
    )
    return
  }
  answer(serverFailureReportUrl(kept, readIssueReportFacts()), argv)
}

/** A configuration's verdict, as the bug report's logs state it. */
type Verdict =
  | { readonly kind: 'none' }
  | { readonly kind: 'passed'; readonly parsed: unknown }
  | { readonly kind: 'refused'; readonly report: readonly string[] }

/** Validate `path` exactly as `sovrium validate` does. */
const validate = async (path: string): Promise<Verdict> => {
  const { loadConfigForValidationWithSources, validateParsedConfig } = await import('./validate')
  const { parsed, refSources } = await loadConfigForValidationWithSources(path)
  const outcome = await validateParsedConfig(parsed, refSources, resolve(path))
  return outcome.valid ? { kind: 'passed', parsed } : { kind: 'refused', report: outcome.report }
}

/** The configuration to check: the one `--config` names, else the one in this directory. */
const configToCheck = async (named: string | undefined): Promise<string | undefined> => {
  if (named !== undefined) {
    if (!existsSync(named)) {
      refuse(
        `Config file not found: ${named}. No address was printed.`,
        'Check the path given to --config.'
      )
    }
    return named
  }
  const { discoverDefaultConfigFile } = await lazyImportSchema()
  return discoverDefaultConfigFile(process.cwd())
}

/** `path` as written, its secrets redacted: what `repro-config` carries. */
const redactedConfig = async (path: string, parsed: unknown): Promise<string> => {
  const text = await Bun.file(path).text()
  const withoutDefaults = redactEnvDefaults(text, secretEnvDefaultsOf(parsed))
  return scrubReportText(
    redactValues(withoutDefaults, secretEnvValues(process.env)),
    readReportScrub()
  )
}

const reportBug = async (
  configFlag: { readonly given: boolean; readonly value?: string },
  argv: readonly string[]
): Promise<void> => {
  if (configFlag.given && configFlag.value === undefined) {
    refuse(
      '--config needs the path of a configuration file. No address was printed.',
      'Give it the file to attach, such as app.yaml.'
    )
  }
  const path = await configToCheck(configFlag.value)
  const verdict: Verdict = path === undefined ? { kind: 'none' } : await validate(path)
  if (verdict.kind === 'refused') {
    printStderr(
      [
        'Error: This configuration does not validate, so no report was made.',
        '',
        ...verdict.report,
        '',
        'A configuration error is yours to fix in the configuration, not a bug in Sovrium.',
        'Run `sovrium validate` to check it again, and `sovrium docs` to look an option up.',
      ].join('\n')
    )
    // Terminate process - imperative statement required for CLI
    process.exit(1)
  }
  const attached =
    configFlag.value !== undefined && verdict.kind === 'passed'
      ? { 'repro-config': await redactedConfig(configFlag.value, verdict.parsed) }
      : {}
  const logs =
    verdict.kind === 'passed'
      ? 'sovrium validate: passed'
      : 'sovrium validate: no configuration found'
  const url = buildIssueReportUrl({
    form: 'bug.yml',
    title: '',
    fields: bugReportFields(readIssueReportFacts(), { logs, ...attached }),
  })
  printStderr(
    `Filled in: the version, the operating system, the install channel, the database and the validation result${attached['repro-config'] === undefined ? '' : ', and the configuration with its secrets redacted'}. Nothing is sent until you submit the form.`
  )
  answer(url, argv)
}

/** Handle `sovrium report`. */
export const handleReportCommand = async (argv: readonly string[]): Promise<void> => {
  if (argv.includes('--security')) return reportVulnerability(argv)
  const feature = readValueFlag(argv, '--feature')
  if (feature.given) return reportFeature(feature.value, argv)
  if (argv.includes('--last-error')) return reportLastError(argv)
  const requestId = readValueFlag(argv, '--request-id')
  if (requestId.given) return reportServerError(requestId.value, argv)
  return reportBug(readValueFlag(argv, '--config'), argv)
}
