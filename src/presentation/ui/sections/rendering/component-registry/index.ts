/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { aiChatComponent } from './ai-chat-component'
import { codeBlockComponent } from './code-block-component'
import { commandPaletteComponent } from './command-palette-component'
import { displayComponents } from './display-components'
import { favoritesButtonComponent } from './favorites-button-component'
import { interactiveComponents } from './interactive-components'
import { islandComponents } from './island-components'
import { marqueeComponent } from './marquee-component'
import { mediaComponents } from './media-components'
import { navigationComponents } from './navigation-components'
import { progressComponent } from './progress-component'
import { recordFieldComponent } from './record-field-component'
import { reorderableListComponent } from './reorderable-list-component'
import { skeletonComponent } from './skeleton-component'
import { commentsComponent, commentCountComponent } from './social-components'
import { specialComponents } from './special-components'
import { splitPaneComponent } from './split-pane-component'
import { structuralComponents } from './structural-components'
import { textComponents } from './text-components'
import { themeToggleComponent } from './theme-toggle-component'
import { tocComponent } from './toc-component'
import type { ComponentRenderer, DispatchableComponentType } from '../component-dispatch-config'

/**
 * Component registry mapping component types to their renderer functions
 *
 * This registry combines all component categories:
 * - Structural: section, header, footer, div, container, etc.
 * - Text: h1-h6, heading, text, paragraph, code, etc.
 * - Media: image, video, audio, iframe, etc.
 * - Interactive: button, link, form, input, icon, badge, etc.
 * - Special: hero, card-*, speech-bubble, navigation, list, etc.
 * - Islands: data-table, search-input (SSR placeholders for client-side React)
 */
export const COMPONENT_REGISTRY: Partial<Record<DispatchableComponentType, ComponentRenderer>> = {
  ...structuralComponents,
  ...textComponents,
  ...mediaComponents,
  ...interactiveComponents,
  ...specialComponents,
  ...displayComponents,
  ...navigationComponents,
  ...islandComponents,
  // `code` — standalone code block with optional frame chrome (filename header,
  // terminal marker, command output) and a working copy button. Extracted from
  // `textComponents` so neither file carries two growing dispatches.
  code: codeBlockComponent,
  // `marquee` — a continuously scrolling band of children. CSS-only (no island):
  // the animation, the seam clone's inertness and the pause states are all
  // driven by the `[data-marquee-*]` rules in `marquee-styles-generator.ts`.
  marquee: marqueeComponent,
  'ai-chat': aiChatComponent,
  // `split-pane` — resizable two-pane layout.
  // SSR renders the static side-by-side structure; a sibling `data-island`
  // marker hydrates the drag-to-resize behaviour in place.
  'split-pane': splitPaneComponent,
  'record-field': recordFieldComponent,
  progress: progressComponent,
  skeleton: skeletonComponent,
  'reorderable-list': reorderableListComponent,
  // `favorites-button` is never schema-authored — it is synthesized at render
  // time by `data-source-resolver` and injected into single-record-bound
  // containers. The cast keeps the render-time-only type out of the
  // schema-facing `Component['type']` union.
  'favorites-button': favoritesButtonComponent,
  // `command-palette` is never schema-authored — it is synthesized at render
  // time by `render-page` and appended to every page so the global `Cmd+K`
  // palette is available app-wide.
  'command-palette': commandPaletteComponent,
  comments: commentsComponent,
  commentCount: commentCountComponent,
  // `theme-toggle` — runtime light/dark switch. Emits an accessible button;
  // its click behaviour is wired by the body-end theme-toggle runtime and the
  // no-FOUC head script (see PageBodyScripts / PageHead).
  'theme-toggle': themeToggleComponent,
  // `toc` — table of contents. Schema author writes `{ type: 'toc' }`; the
  // page-level `resolvePageToc` pass walks the tree, assigns ids to every
  // heading, and plumbs the collected headings onto each toc component as
  // a render-time `tocHeadings` field that this renderer consumes.
  toc: tocComponent,
} as Partial<Record<DispatchableComponentType, ComponentRenderer>> &
  Record<string, ComponentRenderer>

// Re-export individual component groups for granular imports if needed
export { structuralComponents } from './structural-components'
export { textComponents } from './text-components'
export { mediaComponents } from './media-components'
export { interactiveComponents } from './interactive-components'
export { specialComponents } from './special-components'
export { islandComponents } from './island-components'
