/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolvePrivacySignals } from '@/domain/models/app/analytics/privacy-signals-service'
import { someComponentInTree } from '@/presentation/render/resolve/component-template-walker'
import type { PageConsent } from './analytics-beacon-script'
import type { PrivacySignalSettings } from '@/domain/models/app/analytics/privacy-signals-service'
import type { Components } from '@/domain/models/app/components'
import type { Page } from '@/domain/models/app/pages'
import type { Tables } from '@/domain/models/app/tables'

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
  /** A declared purpose: the script waits until the visitor accepts it. */
  readonly consent?: string
}

/**
 * Inline script configuration
 */
export type InlineScript = {
  readonly code: string
  readonly position?: 'head' | 'body-start' | 'body-end'
  readonly async?: boolean
  /** A declared purpose: the script waits until the visitor accepts it. */
  readonly consent?: string
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
  /**
   * The page draws a `sidebar`, directly or through a referenced template, so
   * the body-end enhancer that keeps its current entry in view ships with it.
   * A page with no sidebar carries none of that script.
   */
  readonly revealsSidebarCurrent: boolean
  /**
   * The page draws a `toc`, directly or through a referenced template, so the
   * body-end enhancer that marks the link to the section being read ships with
   * it. A page with no outline carries none of that script.
   */
  readonly spiesToc: boolean
  /**
   * The privacy signals the app honours, present only when the page draws a
   * `consent-choice`, directly or through a referenced template: the body-end
   * consent runtime ships with it and reads them. A page with no such control
   * carries none of that script.
   */
  readonly consentChoice: PrivacySignalSettings | undefined
  /** The app's `consent` block: the page draws the banner and holds what it gates. */
  readonly consent: PageConsent | undefined
  /**
   * The app declares a `datetime` field on `timeZone: local`, so the body-end
   * enhancer that writes such a moment in the reader's zone ships with its pages.
   */
  readonly writesReaderZone: boolean
}

/** Whether any `datetime` field of the app asks for each reader's own zone. */
const declaresReaderZone = (tables: Tables | undefined): boolean =>
  (tables ?? []).some((table) =>
    table.fields.some(
      (field) =>
        field.type === 'datetime' && (field as { readonly timeZone?: unknown }).timeZone === 'local'
    )
  )

/**
 * Removes entries whose `src` was already declared by an earlier entry
 *
 * First declaration wins: the surviving tag keeps the attributes of the entry
 * that appeared first in the merged list.
 */
function dedupeBySrc(scripts: ReadonlyArray<ExternalScript>): ReadonlyArray<ExternalScript> {
  return scripts.filter(
    (script, index) => scripts.findIndex((other) => other.src === script.src) === index
  )
}

/**
 * Groups external and inline scripts by their position in the document
 *
 * Scripts can be positioned in 'head', 'body-start', or 'body-end'.
 * Scripts without a position default to 'body-end'.
 *
 * @param page - Page configuration containing scripts
 * @param components - The app's component templates, which a page may reference
 * @param privacySignals - The privacy signals the app's analytics honours, at
 *   their documented defaults when omitted
 * @param tables - The app's tables: a `local` datetime field ships the reader-zone enhancer
 * @returns Scripts grouped by position
 */
export function groupScriptsByPosition(
  page: Page,
  components?: Components,
  privacySignals?: PrivacySignalSettings & { readonly consent?: PageConsent },
  tables?: Tables
): Readonly<GroupedScripts> {
  // `scripts.external` is an ALIAS of `scripts.externalScripts` — the two keys
  // name ONE list, not two independent ones. Merge them and drop any src the
  // merged list already carries, so a URL written under both keys renders a
  // single tag (a duplicated classic script would otherwise be executed twice).
  // `externalScripts` is merged first, so it wins the attributes on a conflict.
  const externalScripts = dedupeBySrc([
    ...(page.scripts?.externalScripts ?? []),
    ...(page.scripts?.external ?? []),
  ])

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
    revealsSidebarCurrent: someComponentInTree(
      page.components,
      components,
      (item) => item['type'] === 'sidebar'
    ),
    spiesToc: someComponentInTree(page.components, components, (item) => item['type'] === 'toc'),
    consentChoice: someComponentInTree(
      page.components,
      components,
      (item) => item['type'] === 'consent-choice'
    )
      ? (privacySignals ?? resolvePrivacySignals(undefined))
      : undefined,
    consent: privacySignals?.consent,
    writesReaderZone: declaresReaderZone(tables),
  }
}
