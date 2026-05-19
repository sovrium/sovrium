/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { buildComponentUnion } from '../pages/components/component-types'

export const ComponentChildrenSchema: Schema.Schema<
  ReadonlyArray<unknown>,
  ReadonlyArray<unknown>,
  never
> = Schema.Array(
  Schema.Union(
    Schema.suspend(() => ComponentChildElementSchema).pipe(
      Schema.annotations({
        identifier: 'ComponentChildElement',
      })
    ),
    Schema.String
  )
).pipe(
  Schema.annotations({
    title: 'Component Children',
    description: 'Child elements array for component templates (components or strings)',
  })
)

export const ComponentChildElementSchema: Schema.Schema<any, any, never> = buildComponentUnion({
  children: Schema.optional(
    Schema.suspend(() => ComponentChildrenSchema).pipe(
      Schema.annotations({
        identifier: 'ComponentChildren',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'Component Child Element',
    description: 'Component element in a component template',
  })
)

export type ComponentChildElement = Schema.Schema.Type<typeof ComponentChildElementSchema>
export type ComponentChildren = Schema.Schema.Type<typeof ComponentChildrenSchema>
