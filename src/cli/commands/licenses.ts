/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium licenses [--format md|json] [--output <path>]`
 *
 * Prints the third-party license notices this binary carries: the components
 * whose license requires its own notice (MPL-2.0, OFL-1.1, PSF-2.0, the Bun
 * runtime), then every other production package with its version, copyright
 * line(s) and license text, identical texts printed once.
 *
 * Offline by construction: no config, no database, no network. The payload is
 * reached through `await import()` so `sovrium start` never loads it.
 */

import { resolveDocumentFormat, writeDocument } from './document-output'
import type {
  EmbeddedComponent,
  EmbeddedLicenseNotice,
  EmbeddedLicensesPayload,
} from '@/infrastructure/assets/embedded-licenses-payload'

export interface LicensesCommandOptions {
  /** The RAW `--format` value, validated here. */
  readonly format?: string
  readonly outputPath?: string
}

const heading = (notice: EmbeddedLicenseNotice): string =>
  `${notice.name}${notice.version === null ? '' : ` ${notice.version}`} — ${notice.license}`

const fence = (text: string): readonly string[] => ['````text', text.trimEnd(), '````']

/** Components grouped by license body, the largest group first, then by text id. */
const groupsOf = (
  payload: Pick<EmbeddedLicensesPayload, 'texts' | 'components'>
): readonly { readonly text: string; readonly members: readonly EmbeddedComponent[] }[] =>
  payload.texts
    .map((text) => ({
      id: text.id,
      text: text.text,
      members: payload.components.filter((component) => component.textId === text.id),
    }))
    .filter((group) => group.members.length > 0)
    .toSorted((a, b) => b.members.length - a.members.length || a.id.localeCompare(b.id, 'en'))

const memberLine = (component: EmbeddedComponent): string =>
  `- ${component.name} ${component.version}${
    component.copyright.length === 0 ? '' : ` — ${component.copyright.join('; ')}`
  }`

/**
 * The markdown document. First the components whose license requires its text
 * (each with its own notice), then every other component, grouped by identical
 * license text: the text is printed once, after the list of packages that carry
 * it, each with its version and its own copyright line(s).
 */
export const renderLicensesMarkdown = (
  payload: Pick<EmbeddedLicensesPayload, 'notices' | 'texts' | 'components'>
): string => {
  const groups = groupsOf(payload)
  return [
    '# Third-party licenses',
    '',
    `This binary carries ${payload.notices.length + payload.components.length} third-party component(s). Sovrium itself is licensed separately: see LICENSE.md in the Sovrium repository.`,
    '',
    '## Components with a notice of their own',
    '',
    ...payload.notices.flatMap((notice) => [
      `### ${heading(notice)}`,
      '',
      `Source: ${notice.source}`,
      '',
      ...fence(notice.text),
      '',
    ]),
    '## Other open-source components',
    '',
    `${payload.components.length} package(s), under ${groups.length} distinct license text(s). Each text is printed once, after the packages it covers.`,
    '',
    ...groups.flatMap((group, index) => {
      const licenses = [...new Set(group.members.map((member) => member.spdx))].toSorted()
      return [
        `### Text ${index + 1} of ${groups.length} — ${licenses.join(', ')} (${group.members.length} package(s))`,
        '',
        ...group.members.map(memberLine),
        '',
        ...fence(group.text),
        '',
      ]
    }),
  ].join('\n')
}

/** The JSON document: the payload's three arrays, unchanged. */
export const renderLicensesJson = (
  payload: Pick<EmbeddedLicensesPayload, 'notices' | 'texts' | 'components'>
): string =>
  `${JSON.stringify(
    {
      format: 'sovrium-licenses',
      notices: payload.notices,
      texts: payload.texts,
      components: payload.components,
    },
    null,
    2
  )}\n`

/** Handle the `licenses` command. */
export const handleLicensesCommand = async (options: LicensesCommandOptions): Promise<void> => {
  const format = resolveDocumentFormat(options.format, ['json'], 'markdown.')
  const { loadEmbeddedLicenses } = await import('@/infrastructure/assets/embedded-licenses')
  const payload = await loadEmbeddedLicenses()
  const content = format === 'json' ? renderLicensesJson(payload) : renderLicensesMarkdown(payload)
  await writeDocument(content, options.outputPath, 'Third-party licenses')
}
