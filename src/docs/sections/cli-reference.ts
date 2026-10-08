/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import changelogBody from '@/cli/commands/changelog.docs.md' with { type: 'file' }
import renderBody from '@/cli/commands/render.docs.md' with { type: 'file' }
import { defineArticle } from './define'
import type { DocArticle } from './define'

/**
 * The CLI articles of the verbs that read something offline and print it —
 * a template filled with sample values, the release notes the binary carries —
 * kept beside `cli-api.ts`, which lists them in its section, so that file stays
 * under its line ceiling.
 */
export const cliReferenceArticles: readonly DocArticle[] = [
  defineArticle({
    slug: 'cli-render',
    title: 'Previewing a Template',
    description:
      'Render one template asset the way an automation would, with its sample data or yours, and print it or write it to a file — offline, with no server and no database.',
    keywords: [
      'sovrium render',
      'preview',
      'template',
      'sampleData',
      '--data',
      '--out',
      '--email',
      '--locale',
    ],
    order: 1496,
    sidebarLabel: 'Previewing a Template',
    body: renderBody,
    documents: [],
    stories: ['US-CLI-RENDER-COMMAND'],
  }),
  defineArticle({
    slug: 'cli-changelog',
    title: 'Release Notes',
    description:
      'Read what changed in the version you run, in any earlier version, or since the version you upgraded from — breaking changes first, from the binary, with no network.',
    keywords: [
      'sovrium changelog',
      'release notes',
      'changelog',
      'what changed',
      'breaking changes',
      'upgrade',
      '--since',
      '--list',
    ],
    order: 1497,
    sidebarLabel: 'Release Notes',
    body: changelogBody,
    documents: [],
    stories: ['US-CLI-COMMANDS-CHANGELOG'],
  }),
]
