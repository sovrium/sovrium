/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What `sovrium init` says when a project it brings from elsewhere contains
 * code — a remote `owner/repo` template, a published document (`--from-url`),
 * a bundle (`--from-bundle`).
 *
 * Two things in a project run as code on the machine that starts it: an
 * `app.ts` at its root, which `sovrium start` imports as a program, and an
 * automation's `code` step, which runs TypeScript on every trigger with the
 * access the project has, whatever the config's format. Each is named — the
 * file, or the automation and the step (`codeStepsOf`) — so the person can
 * read them before starting the project. A remote template carries no
 * publisher verdict, so it is refused until `--allow-code`; a document or a
 * bundle is created, the paragraph printed beside where it came from.
 */

import { join } from 'node:path'
import { refuseCommand } from '@/cli/runtime/run-command'
import { parseSchemaContent } from '@/domain/models/app/app-content-parsing'
import { codeStepsOf, type CodeStep } from '@/domain/models/app/automations/code-steps-service'
import { resolveRefs } from '@/infrastructure/config'
import { printDocument, type CliBlock } from '@/infrastructure/logging/cli-output'

/** Where a project runs code: its `app.ts`, and its automation steps that run code. */
export interface CodeSites {
  readonly appTs: boolean
  readonly steps: readonly CodeStep[]
}

/** Whether any code was found. */
export const containsCode = (sites: CodeSites): boolean => sites.appTs || sites.steps.length > 0

/** One sentence per place that runs code. */
const siteLines = (sites: CodeSites): readonly string[] => [
  ...(sites.appTs ? ['app.ts runs as a program when the project starts.'] : []),
  ...sites.steps.map(
    ({ automation, step }) =>
      `The automation ${automation} runs TypeScript in its step ${step}, with the access the project has.`
  ),
]

/**
 * The paragraph for a project that was created and contains code: the fact,
 * then each place, as one block of a document. Empty when it contains none.
 */
export const codeNoticeBlock = (sites: CodeSites, fact: string): CliBlock =>
  containsCode(sites) ? [{ text: fact, detail: siteLines(sites) }] : []

/** Print {@link codeNoticeBlock} as its own document; prints nothing for a project with no code. */
export const printCodeNotice = (sites: CodeSites, fact: string): void => {
  if (containsCode(sites)) printDocument([codeNoticeBlock(sites, fact)])
}

/** Refuse a source that contains code, before anything is written, naming each place and the flag. */
export const refuseCode = (source: string, sites: CodeSites): never => {
  return refuseCommand({
    headline: `${source} contains code — nothing was written.`,
    detail: siteLines(sites),
    guidance: 'Read it, then run the command again with --allow-code.',
  })
}

/** The config file names a project root may hold, in the order `sovrium start` looks. */
const DATA_CONFIG_NAMES = ['app.yaml', 'app.yml', 'app.json'] as const

/**
 * The code a project tree holds, read without writing anything: an `app.ts` at
 * its root, and the code steps of its data config with every local `$ref`
 * partial inlined. A partial that cannot be read leaves its `$ref` in place,
 * so the root's own steps are still named rather than none at all.
 */
export const codeSitesInTree = async (root: string): Promise<CodeSites> => {
  const appTs = await Bun.file(join(root, 'app.ts')).exists()
  const present = await Promise.all(
    DATA_CONFIG_NAMES.map(async (name) => ((await Bun.file(join(root, name)).exists()) ? name : ''))
  )
  const configName = present.find((name) => name !== '')
  if (configName === undefined) return { appTs, steps: [] }
  const content = await Bun.file(join(root, configName)).text()
  const raw = safely(() =>
    parseSchemaContent(content, configName.endsWith('.json') ? 'json' : 'yaml', Bun.YAML)
  )
  const resolved = await resolveRefs(raw, root).catch(() => raw)
  return { appTs, steps: codeStepsOf(resolved) }
}

/** `run()`, or `undefined` when it throws: an unparseable config holds no step to name. */
const safely = <T>(run: () => T): T | undefined => {
  try {
    return run()
  } catch {
    return undefined
  }
}
