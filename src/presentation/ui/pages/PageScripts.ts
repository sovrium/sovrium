/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Page } from '@/domain/models/app/pages'

/**
 * External script configuration
 */
export type ExternalScript = {
  readonly src: string
  readonly position?: 'head' | 'body-start' | 'body-end'
  readonly async?: boolean
  readonly defer?: boolean
  readonly module?: boolean
  readonly integrity?: string
  readonly crossorigin?: 'anonymous' | 'use-credentials'
}

/**
 * Inline script configuration
 */
export type InlineScript = {
  readonly code: string
  readonly position?: 'head' | 'body-start' | 'body-end'
  readonly async?: boolean
}

/**
 * Grouped scripts by position
 */
export type GroupedScripts = {
  readonly external: {
    readonly head: ReadonlyArray<ExternalScript>
    readonly bodyStart: ReadonlyArray<ExternalScript>
    readonly bodyEnd: ReadonlyArray<ExternalScript>
  }
  readonly inline: {
    readonly head: ReadonlyArray<InlineScript>
    readonly bodyStart: ReadonlyArray<InlineScript>
    readonly bodyEnd: ReadonlyArray<InlineScript>
  }
}

/**
 * Groups external and inline scripts by their position in the document
 *
 * Scripts can be positioned in 'head', 'body-start', or 'body-end'.
 * Scripts without a position default to 'body-end'.
 *
 * @param page - Page configuration containing scripts
 * @returns Scripts grouped by position
 */
export function groupScriptsByPosition(page: Page): Readonly<GroupedScripts> {
  // Extract external scripts (support both test shorthand and canonical property)
  const externalScripts = page.scripts?.externalScripts || page.scripts?.external || []

  // Extract inline scripts
  const inlineScripts = page.scripts?.inlineScripts || []

  return {
    external: {
      head: externalScripts.filter((script) => script.position === 'head'),
      bodyStart: externalScripts.filter((script) => script.position === 'body-start'),
      bodyEnd: externalScripts.filter(
        (script) => !script.position || script.position === 'body-end'
      ),
    },
    inline: {
      head: inlineScripts.filter((script) => script.position === 'head'),
      bodyStart: inlineScripts.filter((script) => script.position === 'body-start'),
      bodyEnd: inlineScripts.filter((script) => !script.position || script.position === 'body-end'),
    },
  }
}
