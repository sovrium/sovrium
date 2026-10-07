/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Page } from '@/domain/models/app'

/**
 * AI crawlers that fetch a page to answer a person's question right now, with
 * a link back — the assistant equivalent of a search result. Allowed.
 */
const AI_RETRIEVAL_AGENTS = 'OAI-SearchBot Claude-SearchBot PerplexityBot Meta-WebIndexer'

/**
 * The tokens AI vendors honour for collecting pages to TRAIN models. Asked to
 * stay away: a business publishing its site has agreed to be found, not to
 * be absorbed into a model.
 */
const AI_TRAINING_AGENTS =
  'GPTBot ClaudeBot Google-Extended Applebot-Extended Meta-ExternalAgent CCBot Bytespider'

/** The `User-agent` lines opening a group for a space-separated list of tokens. */
const agentLines = (agents: string): readonly string[] =>
  agents.split(' ').map((agent) => `User-agent: ${agent}`)

/** The advisory content signal stated to every other crawler. */
const CONTENT_SIGNAL = 'Content-Signal: search=yes, ai-input=yes, ai-train=no'

/**
 * Generate robots.txt content.
 *
 * Three groups, then the sitemap. AI retrieval crawlers are allowed and AI
 * training crawlers disallowed, each in its own group (a crawler obeys the
 * most specific group naming it, so neither inherits the other's rule).
 * Every other crawler reads the catch-all: the advisory content signal, the
 * site open, and the reserved `/_` pages closed. Fixed for every app — there
 * is no option to turn it.
 */
export const generateRobotsContent = (
  pages: readonly Page[],
  baseUrl: string,
  includeSitemap: boolean = false
): string => {
  const retrieval = [...agentLines(AI_RETRIEVAL_AGENTS), 'Allow: /']
  const training = [...agentLines(AI_TRAINING_AGENTS), 'Disallow: /']

  // Disallow only the reserved underscore-prefixed pages (admin/internal).
  // A `noindex` page is deliberately NOT disallowed: a crawler refused the
  // fetch never reads the page's `noindex` tag, so a URL linked from elsewhere
  // can still be indexed (bare, without a snippet). Keeping it crawlable is
  // what lets the tag take effect.
  const disallowLines = pages
    .filter((page) => page.path.startsWith('/_'))
    .map((page) => `Disallow: ${page.path}`)
  const catchAll = ['User-agent: *', CONTENT_SIGNAL, 'Allow: /', ...disallowLines]

  const groups = [retrieval, training, catchAll].map((lines) => lines.join('\n'))
  const sitemap = includeSitemap ? [`Sitemap: ${baseUrl}/sitemap.xml`] : []
  return [...groups, ...sitemap].join('\n\n')
}
