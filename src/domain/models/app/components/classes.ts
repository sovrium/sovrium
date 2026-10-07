/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ComponentClassesSchema } from '../component-style'

/**
 * The `classes` a component TEMPLATE carries — the same part-keyed class map a
 * page component takes, so a template can ship the styling of its parts with
 * it and every placement inherits it.
 *
 * It is the shared {@link ComponentClassesSchema}, named here because a
 * template's object-typed keys each have their home in this directory beside
 * `props` and `guidance`. A placement's own `classes` are layered over the
 * template's, exactly as its `props` are.
 */
export const ComponentTemplateClassesSchema = ComponentClassesSchema

/** @public */
export type ComponentTemplateClasses = typeof ComponentTemplateClassesSchema.Type
