/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'

/**
 * Shared helper to render meta tags with configurable attribute type
 * Eliminates duplication between OpenGraph and Twitter Card rendering
 *
 * @param fields - Array of key-value pairs to render as meta tags
 * @param prefix - Prefix for meta tag name/property (e.g., 'og', 'twitter')
 * @param attributeType - HTML attribute to use ('property' for OG, 'name' for Twitter)
 * @returns React fragment with meta tags
 */
export function renderMetaTags({
  fields,
  prefix,
  attributeType,
}: {
  readonly fields: ReadonlyArray<{ readonly key: string; readonly value?: string | number }>
  readonly prefix: string
  readonly attributeType: 'property' | 'name'
}): ReactElement {
  return (
    <>
      {fields.map(
        ({ key, value }) =>
          value !== undefined && (
            <meta
              key={key}
              {...{ [attributeType]: `${prefix}:${key}` }}
              content={String(value)}
            />
          )
      )}
    </>
  )
}
