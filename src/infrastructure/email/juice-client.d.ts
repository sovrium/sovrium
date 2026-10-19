/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `juice/client` — the synchronous inliner, which never loads a web resource.
 * The package types only its root (which bundles `web-resource-inliner`), so
 * the one entry point Sovrium imports is typed here.
 */
declare module 'juice/client' {
  interface JuiceClientOptions {
    readonly removeStyleTags?: boolean
    readonly preserveMediaQueries?: boolean
    readonly preserveFontFaces?: boolean
    readonly preserveKeyFrames?: boolean
    readonly preservePseudos?: boolean
    readonly insertPreservedExtraCss?: boolean
    readonly applyWidthAttributes?: boolean
    readonly applyHeightAttributes?: boolean
    readonly applyAttributesTableElements?: boolean
    readonly applyStyleTags?: boolean
    readonly applyLinkTags?: boolean
    readonly resolveCSSVariables?: boolean
  }
  const juice: (html: string, options?: JuiceClientOptions) => string
  export default juice
}
