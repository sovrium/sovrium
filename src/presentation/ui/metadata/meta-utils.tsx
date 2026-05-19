/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'

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
