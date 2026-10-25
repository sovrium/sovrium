/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { DesignComponentsSchema } from './design/components'
import { migrationHintForRemovedKey } from './design/removed-keys'
import { migrationHintForRemovedHostedFormKey } from './forms/removed-keys'
import { migrationHintForRemovedFormKey } from './pages/components/component-types/data/form/removed-keys'
import { migrationHintForRemovedTableKey } from './pages/components/component-types/data/table/removed-keys'
import { migrationHintForRemovedModuleKey } from './pages/components/component-types/modules/removed-keys'
import { migrationHintForPromotedTypeKey } from './pages/components/component-types/promoted-removed-keys'
import { RENAMED_COMPONENT_TYPES } from './pages/components/component-types/renamed-types'
import { migrationHintForRepurposedTypeKey } from './pages/components/component-types/repurposed-removed-keys'
import { migrationHintForRemovedDataSourceKey } from './pages/components/data-source-removed-keys'

/**
 * `design.components` is keyed by component type, so a renamed type is a renamed key there too —
 * for the types that key accepts (`command` draws no server markup and takes no entry).
 */
const RENAMED_DESIGN_COMPONENT_KEYS: ReadonlyMap<string, string> = new Map(
  RENAMED_COMPONENT_TYPES.filter(([, { replacement }]) =>
    Object.hasOwn(DesignComponentsSchema.fields, replacement)
  ).map(([name, { replacement }]) => [
    name,
    `\`design.components.${name}\` is now \`design.components.${replacement}\`: the component type was renamed to the name shadcn/ui gives it.`,
  ])
)

/**
 * The migration sentence for a key the decoder refused as excess, asked of each
 * module that keeps a list of removed or refused keys, first answer wins:
 * `design` keys (renamed component types under `design.components` included), then the hosted form's fields,
 * the page `table`, the page `form`,
 * the shared modules every data component spreads (its `search` box), a component's `dataSource`, the promoted
 * component types and the repurposed ones. `undefined` when none of them knows the key.
 *
 * @param path - Dotted path of the node holding the key.
 * @param discriminant - The node's `type` literal, when it has one.
 * @param key - The property name the author wrote.
 */
export const migrationHintForExcessKey = (
  path: string,
  discriminant: string | undefined,
  key: string
): string | undefined =>
  migrationHintForRemovedKey(path, key) ??
  (path === 'design.components' ? RENAMED_DESIGN_COMPONENT_KEYS.get(key) : undefined) ??
  migrationHintForRemovedHostedFormKey(path, key) ??
  migrationHintForRemovedTableKey(discriminant, key) ??
  migrationHintForRemovedFormKey(path, discriminant, key) ??
  migrationHintForRemovedModuleKey(discriminant, key) ??
  migrationHintForRemovedDataSourceKey(path, key) ??
  migrationHintForPromotedTypeKey(discriminant, key) ??
  migrationHintForRepurposedTypeKey(discriminant, key)
