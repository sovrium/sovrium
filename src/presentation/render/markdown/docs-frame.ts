/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { cn } from '@/presentation/design/class-merge'
import { resolveComponentStyle } from '@/presentation/design/resolve-component-classes'
import type { ComponentStyle, Design } from '@/domain/models/app/design'
import type { ComponentPartName } from '@/domain/models/app/design/component-parts'
import type { Markdown } from '@/domain/models/app/pages/markdown'
import type { CSSProperties } from 'react'

/** The docs frame's measurements, as `markdown.frame` declares them. */
export type DocsFrameMeasures = NonNullable<Markdown['frame']>

/** What the renderer needs of a page's frame: its measurements and its part classes. */
export interface DocsFrame {
  readonly frame?: DocsFrameMeasures
  /** `markdown.classes` collapsed to one class list per part, states prefixed. */
  readonly parts?: Readonly<Partial<Record<ComponentPartName<'markdown'>, string>>>
}

/**
 * The frame fields of a resolved markdown page, from its `markdown` block.
 *
 * The app's `design.components.markdown` is the type layer and the page's own
 * `markdown.classes` the instance layer, so the page wins a conflict on its
 * page alone.
 *
 * @param markdown - The page's `markdown` block.
 * @param design - The app's `design`, if any.
 */
export const docsFrameOf = (markdown: Markdown, design?: Design): DocsFrame => {
  const resolution = resolveComponentStyle(
    design,
    'markdown',
    undefined,
    markdown.classes as ComponentStyle | undefined
  )
  // The two layers are appended per part; merging here lets the page's class
  // beat the app's on a conflict (`text-[20px]` over `text-[26px]`) instead of
  // leaving both on the element for the stylesheet's order to decide.
  const parts = Object.fromEntries(
    Object.entries({
      ...resolution.parts,
      ...(resolution.root ? { root: resolution.root } : {}),
    }).map(([part, classes]) => [part, cn(classes)])
  )
  return {
    ...(markdown.frame === undefined ? {} : { frame: markdown.frame }),
    ...(Object.keys(parts).length === 0 ? {} : { parts }),
  }
}

/**
 * The frame's measurements as custom properties on the docs layout: one static
 * class per region reads each one with the default as its fallback, so the
 * candidate scan sees every class while any px/rem length an author writes
 * reaches the page.
 *
 * @param frame - The declared measurements, if any.
 */
export const docsFrameStyle = (frame: DocsFrameMeasures | undefined): CSSProperties | undefined => {
  if (frame === undefined) return undefined
  const entries = [
    ['--sv-docs-sidebar-width', frame.sidebarWidth],
    ['--sv-docs-toc-width', frame.tocWidth],
    ['--sv-docs-content-max-width', frame.contentMaxWidth],
    ['--sv-docs-sticky-offset', frame.stickyOffset],
  ].filter((entry): entry is [string, string] => entry[1] !== undefined)
  return entries.length === 0 ? undefined : (Object.fromEntries(entries) as CSSProperties)
}

/** The sidebar rail: sticky below the header, the viewport's remaining height, its width. */
export const DOCS_NAV_FRAME_CLASSES =
  'lg:sticky lg:top-[var(--sv-docs-sticky-offset,6.5rem)] lg:h-[calc(100dvh-var(--sv-docs-sticky-offset,6.5rem))] lg:w-[var(--sv-docs-sidebar-width,15rem)] lg:self-start'

/** The outline rail: sticky below the header, at most the remaining height, its width. */
export const DOCS_TOC_FRAME_CLASSES =
  'sticky top-[var(--sv-docs-sticky-offset,6.5rem)] max-h-[calc(100dvh-var(--sv-docs-sticky-offset,6.5rem))] w-[var(--sv-docs-toc-width,14rem)]'

/** The article body's reading measure. */
export const DOCS_CONTENT_MEASURE_CLASSES = 'max-w-[var(--sv-docs-content-max-width,none)]'

/**
 * `menuButton: header` — moves the phone's sections button to the start of the
 * page's first component (the element right before the docs layout, or the
 * header banner drawn before the main landmark) as the page is parsed, so a
 * sticky header carries it. The drawer still finds it by the panel it controls.
 */
export const LIFT_MENU_BUTTON_SCRIPT =
  "(function(){var f=document.currentScript&&document.currentScript.parentElement;var b=document.querySelector('[data-page-banner]');var h=f&&(f.previousElementSibling||(b&&b.lastElementChild));var t=f&&f.querySelector('[data-sidebar-drawer-trigger]');if(h&&t){h.insertBefore(t,h.firstChild)}})()"
