/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ComponentTemplateSchema } from './component'

export const ComponentsSchema = Schema.Array(ComponentTemplateSchema).pipe(
  Schema.annotations({
    identifier: 'Components',
    title: 'Reusable Components',
    description:
      'Array of reusable UI component templates with variable substitution for use across pages',
  }),
  Schema.filter((components) => {
    const names = components.map((component) => component.name)
    const uniqueNames = new Set(names)
    return (
      names.length === uniqueNames.size ||
      'Component names must be unique within the components array'
    )
  })
)

export type Components = Schema.Schema.Type<typeof ComponentsSchema>
