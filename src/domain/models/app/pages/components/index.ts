/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ComponentReferenceSchema } from '../../components/reference'
import { buildComponentUnion, ComponentTypeSchema } from './component-types'

export { ComponentTypeSchema }

export const PageComponentItemSchema = Schema.Union(
  Schema.suspend(() => ComponentSchema).pipe(
    Schema.annotations({
      identifier: 'PageComponent',
    })
  ),
  ComponentReferenceSchema
).annotations({
  title: 'Page Component Item',
  description:
    'A page component that can be either a direct component or component reference (with optional variables)',
})

export const ComponentSchema: Schema.Schema<any, any, never> = buildComponentUnion({
  children: Schema.optional(
    Schema.Array(
      Schema.Union(
        Schema.suspend(() => PageComponentItemSchema).pipe(
          Schema.annotations({
            identifier: 'PageComponentItem',
          })
        ),
        Schema.String
      )
    ).pipe(
      Schema.annotations({
        identifier: 'Children',
        title: 'Child Components',
        description: 'Array of child components or text strings',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'Component',
    description: 'Direct component definition',
  })
)

export const PageComponentsSchema = Schema.Array(PageComponentItemSchema).annotations({
  title: 'Page Components',
  description: 'Array of page components',
})

export type ComponentType = Schema.Schema.Type<typeof ComponentTypeSchema>
export type Component = Schema.Schema.Type<typeof ComponentSchema>
export type PageComponentItem = Schema.Schema.Type<typeof PageComponentItemSchema>
export type PageComponents = Schema.Schema.Type<typeof PageComponentsSchema>
