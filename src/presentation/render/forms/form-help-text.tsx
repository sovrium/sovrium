/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The guidance line under a form field, and the description paragraphs above
 * a form and a step — the three places a hosted form shows author prose.
 *
 * Each takes HTML that `renderInlineMarkdown` produced and sanitizes it again at
 * the sink, so the element is safe whatever its caller passes; the canonical
 * sanitizer is idempotent, so already-sanitized input renders unchanged. Each
 * renders nothing for an empty string.
 * Inline HTML only, which is what keeps `<small>` and `<p>` valid containers.
 */

import { sanitizeRichTextHTML } from '@/domain/kernel/sanitize/html-sanitization'
import { HELP_TEXT_CLASS } from './form-field-chrome'

/** A field's help text: `<small class="help-text">`, or nothing. */
export function HelpText({ html }: { readonly html: string | undefined }) {
  if (html === undefined || html === '') return undefined
  const safeHtml = sanitizeRichTextHTML(html)
  return (
    <small
      className={HELP_TEXT_CLASS}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  )
}

/** A form's or a step's description paragraph, or nothing. */
export function DescriptionText({
  html,
  className,
}: {
  readonly html: string
  readonly className: string
}) {
  if (html === '') return undefined
  const safeHtml = sanitizeRichTextHTML(html)
  return (
    <p
      className={className}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  )
}
