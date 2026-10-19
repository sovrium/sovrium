/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect, Layer } from 'effect'
import { EmailCssInliner } from '@/application/ports/services/email-css-inliner'

/**
 * The one `juice` call site. The synchronous `juice/client` entry never loads
 * a web resource (it does not bundle `web-resource-inliner`), and every option
 * that would keep or add markup beyond the inlined declarations is off: the
 * `<style>` blocks are removed here and, whatever survives, never delivered
 * (the email sanitizer keeps no `<style>`).
 *
 * `juice` (with its HTML parser) is imported by the first message that needs
 * inlining, never at start: most processes send no templated mail. The
 * specifier is a literal so the compiled binary still bundles it.
 */
export const inlineEmailCss = async (html: string): Promise<string> =>
  (await import('juice/client')).default(html, {
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

/** `juice` failed to load or threw on a message: a defect, as the synchronous call was. */
class EmailCssInlineError extends Data.TaggedError('EmailCssInlineError')<{
  readonly cause: unknown
}> {}

/** `EmailCssInliner` over `juice/client`. Building it does nothing. */
export const EmailCssInlinerLive = Layer.succeed(EmailCssInliner, {
  inline: (html) =>
    Effect.tryPromise({
      try: () => inlineEmailCss(html),
      catch: (cause) => new EmailCssInlineError({ cause }),
    }).pipe(Effect.orDie),
})
