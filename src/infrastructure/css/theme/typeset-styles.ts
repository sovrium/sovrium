/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { TYPESET_CSS } from '@/infrastructure/css/generated-css-assets'

/**
 * Typeset: how rendered prose reads — the body of a markdown page, the
 * `content-prose` article, and (in its own lane) a chat answer.
 *
 * Two sheets, kept apart on purpose:
 *
 *  1. **shadcn/ui's `typeset.css`, unchanged.** Vendored byte for byte at
 *     `src/presentation/design/typeset/typeset.css` and embedded through
 *     `generated-css-assets.ts`, which `bun run build:css-assets` refuses to
 *     write unless the copy equals the registry snapshot. It sits in
 *     `@layer components` behind `:where()`, so any utility on an element wins
 *     over it, and it leaves every element carrying a `data-slot` (a component:
 *     a code block frame, a button) to its own styles.
 *  2. **Sovrium's presets, below.** The two presets shadcn's Typeset page shows,
 *     as classes beside `typeset`, and one reset the vendored file cannot carry.
 *
 * Plain CSS, like the code-block and rich-text sheets beside it: Typeset styles
 * markup the author writes (markdown) and never names a utility, so the
 * candidate scan has nothing to find and the rules must be emitted as text.
 */

/**
 * The presets, and the paragraph reset.
 *
 *  - `typeset-docs`: a 15px text with 1.5em between blocks — documentation.
 *  - `typeset-chat`: 1em between blocks and a 1.6 leading — a chat answer,
 *    which reads as a message and not as an article. It also keeps the
 *    bubble's text size at every width, where the vendored sheet sets an
 *    article an eighth larger below 48rem.
 *  - The base layer sizes every `p` for chrome (14px), and the vendored sheet
 *    styles a paragraph's margins but never its size, so a paragraph inside a
 *    Typeset container would read at the chrome size under a 15px preset. Inside
 *    the container it inherits the container's size and line height instead.
 *
 * In `@layer components` after the vendored sheet, so a preset's custom
 * properties beat `.typeset`'s defaults on source order at equal specificity,
 * and a utility on the container still beats both.
 */
const TYPESET_PRESETS = `@layer components {
  .typeset-docs {
    --typeset-size: 15px;
    --typeset-flow: 1.5em;
  }
  .typeset-chat {
    --typeset-flow: 1em;
    --typeset-leading: 1.6;
    font-size: var(--typeset-size);
  }
  .typeset :where(p) {
    font-size: inherit;
    line-height: inherit;
  }
}`

/**
 * The Typeset stylesheet: the vendored sheet, then the presets. Emitted only
 * for an app that sets prose (see `appSetsTypeset`); every other app's
 * stylesheet is byte-identical to what it was before Typeset existed.
 */
export const generateTypesetStyles = (): string => `${TYPESET_CSS}\n${TYPESET_PRESETS}`
