/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Page as PageConfig } from '@/domain/models/app'

type PageComponent = NonNullable<PageConfig['components']>[number]

/**
 * A sentence that carries a figure or a name read from the page record.
 *
 * A `$record.*` inside a translated value does not substitute — the record is
 * bound before the translation is looked up — so a sentence like "Used on 3
 * pages" cannot be one key. It is drawn as consecutive text nodes instead: the
 * translated words, the token, the translated words, each its own node, and
 * the line reads as one sentence in either language. The wrapper is a `div`:
 * a container cannot be a `p` or a `span`.
 */
export const sentence = (
  className: string,
  parts: readonly string[],
  extra: Readonly<Record<string, unknown>> = {}
): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className },
    ...extra,
    children: parts.map((content) => ({ type: 'text', element: 'span', content })),
  }) as PageComponent
