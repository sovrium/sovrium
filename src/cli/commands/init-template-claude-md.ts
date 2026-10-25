/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Render a template's `CLAUDE.md` from its `template.yaml`.
 *
 * The file has two halves separated by a `---` line: a head that is the
 * template's own (title, intro, "This app at a glance", any extra sections,
 * "Working on this app with an AI assistant") and the tail every Sovrium
 * project shares, {@link CLAUDE_MD_BODY}, which a bare `sovrium init` writes
 * too. The two halves never drift because the tail is never copied by hand.
 *
 * The layout rules are the inverse of how a section body is stored: a body
 * carries no blank line at either edge and ends with one newline; the
 * renderer writes `## <heading>`, a blank line, the body and a blank line.
 */

import { CLAUDE_MD_BODY } from './init-scaffold-content'
import type { TemplateFacts } from './init-template-facts'
import type { TemplateManifest, TemplateSection } from './init-template-manifest'

export const CLAUDE_GLANCE_HEADING = '## This app at a glance'
export const CLAUDE_ASSISTANT_HEADING = '## Working on this app with an AI assistant'

/** Render one kept section: `## <heading>`, a blank line, the body, a blank line. */
export const renderTemplateSection = (section: TemplateSection): string =>
  `## ${section.heading}\n\n${section.body}\n`

/** Render one glance bullet: `- ` on its first line, two spaces on each continuation. */
const renderGlanceBullet = (bullet: string): string =>
  `${bullet
    .split('\n')
    .map((line, index) => (index === 0 ? `- ${line}` : `  ${line}`))
    .join('\n')}\n`

/** The template's own head, down to and including the `---` line and the blank line after it. */
export const renderTemplateClaudeMdHead = (
  manifest: TemplateManifest,
  facts: Pick<TemplateFacts, 'appName'>
): string =>
  [
    `# ${facts.appName}\n\n`,
    `${manifest.intro}\n`,
    `${CLAUDE_GLANCE_HEADING}\n\n`,
    manifest.glance.map(renderGlanceBullet).join(''),
    `\n${manifest.glanceClose}\n`,
    (manifest.sections ?? []).map(renderTemplateSection).join(''),
    `${CLAUDE_ASSISTANT_HEADING}\n\n`,
    `${manifest.assistant}\n`,
    '---\n\n',
  ].join('')

/** The whole `CLAUDE.md` of a project scaffolded from a template. */
export const renderTemplateClaudeMd = (
  manifest: TemplateManifest,
  facts: Pick<TemplateFacts, 'appName'>
): string => `${renderTemplateClaudeMdHead(manifest, facts)}${CLAUDE_MD_BODY}`
