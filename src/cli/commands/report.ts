/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { isHeadless, openInBrowser } from '@/cli/runtime/browser-launch'
import { failureReportGuidance } from '@/cli/runtime/failure-report'
import { defineFlags, flag, type FlagsOf } from '@/cli/runtime/flag-schema'
import { lazyImportSchema } from '@/cli/runtime/lazy-modules'
import { refuseCommand, stopCommand, withFlagsAsync } from '@/cli/runtime/run-command'
import { OPERATOR_FIX_GUIDANCE } from '@/domain/errors/operator-fixable-error'
import { REQUEST_SURFACE, serverFailureReportUrl } from '@/domain/kernel/url/issue-report-address'
import {
  bugReportFields,
  parseFailureTitle,
  redactEnvDefaults,
  redactValues,
  scrubReportText,
  secretEnvDefaultsOf,
  secretEnvValues,
} from '@/domain/kernel/url/issue-report-failure'
import { SECURITY_ADVISORY_URL, buildIssueReportUrl } from '@/domain/kernel/url/issue-report-url'
import { printLine, printStderr } from '@/infrastructure/logging/cli-output'
import { readIssueReportFacts, readReportScrub } from '@/infrastructure/logging/issue-report-facts'
import { findServerFailure, readLastCliFailure } from '@/infrastructure/logging/issue-report-store'

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

/** The flags `sovrium report` reads. */
export const reportFlags = defineFlags({
  security: flag.switch('--security'),
  feature: flag.named('--feature'),
  lastError: flag.switch('--last-error'),
  /** `--last-error` in either spelling, for saying `--security` attached nothing. */
  lastErrorSpelled: flag.occurrence('--last-error'),
  requestId: flag.named('--request-id'),
  config: flag.named('--config'),
  open: flag.switch('--open'),
})

type ReportFlags = FlagsOf<typeof reportFlags>

const isFeatureKind = (kind: string): kind is FeatureKind => Object.hasOwn(FEATURE_FORMS, kind)

/** Print the address, open it when asked, and stop. */
const answer = (url: string, flags: ReportFlags): void => {
  printLine(url)
  if (flags.open && !isHeadless()) openInBrowser(url)
}

const refuse = (headline: string, guidance: string): never => refuseCommand({ headline, guidance })

/** `--security`: the advisory form, bare. Nothing else is attached, ever. */
const reportVulnerability = (flags: ReportFlags): void => {
  const attachable = [flags.config, flags.lastErrorSpelled, flags.requestId, flags.feature]
  if (attachable.some((attached) => attached.given)) {
    printStderr(
      'A vulnerability is reported privately, and you write the report yourself, so --security attached nothing.'
    )
  }
  answer(SECURITY_ADVISORY_URL, flags)
}

const reportFeature = (kind: string | undefined, flags: ReportFlags): void => {
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
  answer(buildIssueReportUrl({ form: FEATURE_FORMS[kind], title: '' }), flags)
}

const reportLastError = (flags: ReportFlags): void => {
  const kept = readLastCliFailure()
  if (kept === undefined) {
    refuse(
      'No failure is kept for this project. No address was printed.',
      'A failed start, build or command keeps its report here; run `sovrium report` to report another problem.'
    )
    return
  }
  const title = parseFailureTitle(kept.title)
  if (title !== undefined)
    printStderr(failureReportGuidance(title.surface, title.signature).join('\n'))
  answer(kept.url, flags)
}

const reportServerError = (requestId: string | undefined, flags: ReportFlags): void => {
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
  printStderr(failureReportGuidance(REQUEST_SURFACE, kept.signature).join('\n'))
  answer(serverFailureReportUrl(kept, readIssueReportFacts()), flags)
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
  flags: ReportFlags
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
    return stopCommand(
      1,
      [
        'Error: This configuration does not validate, so no report was made.',
        '',
        ...verdict.report,
        '',
        'A configuration error is yours to fix in the configuration, not a bug in Sovrium.',
        'Run `sovrium validate` to check it again, and `sovrium docs` to look an option up.',
      ].join('\n')
    )
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
  answer(url, flags)
}

const report = async (flags: ReportFlags): Promise<void> => {
  if (flags.security) return reportVulnerability(flags)
  if (flags.feature.given) return reportFeature(flags.feature.value, flags)
  if (flags.lastError) return reportLastError(flags)
  if (flags.requestId.given) return reportServerError(flags.requestId.value, flags)
  return reportBug(flags.config, flags)
}

/** Handle `sovrium report`. */
export const handleReportCommand = withFlagsAsync(reportFlags, ({ flags }) => report(flags))
