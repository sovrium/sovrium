/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Page } from '@/domain/models/app/pages'

export type ExternalScript = {
  readonly src: string
  readonly position?: 'head' | 'body-start' | 'body-end'
  readonly async?: boolean
  readonly defer?: boolean
  readonly module?: boolean
  readonly integrity?: string
  readonly crossorigin?: 'anonymous' | 'use-credentials'
}

export type InlineScript = {
  readonly code: string
  readonly position?: 'head' | 'body-start' | 'body-end'
  readonly async?: boolean
}

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

export function groupScriptsByPosition(page: Page): Readonly<GroupedScripts> {
  const externalScripts = [
    ...(page.scripts?.externalScripts ?? []),
    ...(page.scripts?.external ?? []),
  ]

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
