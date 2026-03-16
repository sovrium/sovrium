/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { PathSchema as CommonPathSchema } from '../common/definitions'

/**
 * URL Path (where the page is accessible)
 *
 * Re-exports the common Path schema from definitions.
 * See PathSchema in common/definitions for full documentation.
 *
 * @see specs/app/pages/path/path.schema.json
 * @see specs/app/common/definitions.schema.json#/definitions/path
 */
export const PagePathSchema = CommonPathSchema

export type PagePath = typeof PagePathSchema.Type
