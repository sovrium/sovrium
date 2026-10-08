/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import juice from 'juice/client'

/**
 * COPY THE RULES OF AN EMAIL'S `<style>` BLOCKS ONTO THE ELEMENTS THEY MATCH.
 *
 * Mail clients drop `<style>`, so a message styled the way designers write it
 * (a style block and classes) reads unstyled unless each rule travels as a
 * `style` attribute. The synchronous `juice/client` inliner does it and never
 * loads anything (a linked stylesheet is not followed). Run BEFORE the email
 * sanitizer, so an inlined declaration is filtered exactly like an authored
 * `style` attribute; the blocks themselves are removed here and, whatever
 * survives, never delivered (the sanitizer keeps no `<style>`).
 */
export const inlineEmailCss = (html: string): string =>
  juice(html, {
    removeStyleTags: true,
    preserveMediaQueries: false,
    preserveFontFaces: false,
    preserveKeyFrames: false,
    preservePseudos: false,
    insertPreservedExtraCss: false,
    applyWidthAttributes: false,
    applyHeightAttributes: false,
    applyAttributesTableElements: false,
    applyLinkTags: false,
    resolveCSSVariables: false,
  })
