/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { TOC_SCROLLSPY_SCRIPT } from '@/presentation/render/markdown/markdown-article-enhancements'
import { CARRIED_TOAST_READER_SCRIPT } from '@/presentation/render/scripts/carried-toast-reader-script'
import { CODE_SCROLL_REGION_SCRIPT } from '@/presentation/render/scripts/code-scroll-region-script'
import { buildConsentChoiceScript } from '@/presentation/render/scripts/consent-choice-script'
import { MARQUEE_PAUSE_SCRIPT } from '@/presentation/render/scripts/marquee-pause-script'
import { READER_ZONE_TIME_SCRIPT } from '@/presentation/render/scripts/reader-zone-time-script'
import { SIDEBAR_CURRENT_REVEAL_SCRIPT } from '@/presentation/render/scripts/sidebar-current-reveal-script'
import { TABLE_SCROLL_REGION_SCRIPT } from '@/presentation/render/scripts/table-scroll-region-script'
import type { GroupedScripts } from './page-scripts'

/**
 * The module-held tail of the single body-end enhancer script.
 *
 * Stateless behavioral enhancer scripts are concatenated into a single
 * <script> tag (rather than emitted as separate elements) to keep the
 * page-level inline-script count stable. A pages scripts spec asserts
 * `script:not([src])` matches exactly one element under strict mode;
 * adding a sibling <script> would break that contract for a non-feature
 * reason. Every enhancer is an IIFE, so their internals never leak across
 * the concatenation, and every one that binds a handler binds it DELEGATED
 * on `document` — which is what lets a control inside a `tabs` panel work
 * even though the panel mounts after hydration. Order is therefore not
 * load-bearing; keep it stable only to keep diffs readable:
 * `page-body-scripts.tsx` emits clickScript (delegated click/modal),
 * autoResizeScript (textarea grow), themeToggleScript and copyCodeScript,
 * then appends this tail: the code-block scroll regions (observers, not a
 * click), MARQUEE_PAUSE_SCRIPT, the carried-toast reader (a
 * toast the previous page carried here, shown once), the sidebar reveal,
 * shipped only on a page that draws a sidebar, the outline scroll-spy, shipped
 * only on a page that draws a `toc`, the markdown table scroll regions
 * (observers, not a click), the `consent-choice` runtime, shipped only on a
 * page that draws one, with the privacy signals the app honours, and the
 * reader-zone writer, shipped only for an app declaring a `local` datetime.
 *
 * SECURITY: Safe - a concatenation of engine-authored constants, no user input.
 */
export function buildBodyEndEnhancerTail(
  scripts: Pick<
    GroupedScripts,
    'revealsSidebarCurrent' | 'spiesToc' | 'consentChoice' | 'consent' | 'writesReaderZone'
  >
): string {
  const { revealsSidebarCurrent, spiesToc, consentChoice, consent, writesReaderZone } = scripts
  return (
    CODE_SCROLL_REGION_SCRIPT +
    MARQUEE_PAUSE_SCRIPT +
    CARRIED_TOAST_READER_SCRIPT +
    (revealsSidebarCurrent ? SIDEBAR_CURRENT_REVEAL_SCRIPT : '') +
    (spiesToc ? TOC_SCROLLSPY_SCRIPT : '') +
    TABLE_SCROLL_REGION_SCRIPT +
    (consentChoice === undefined
      ? ''
      : buildConsentChoiceScript(consentChoice, consent?.declaration)) +
    (writesReaderZone ? READER_ZONE_TIME_SCRIPT : '')
  )
}
