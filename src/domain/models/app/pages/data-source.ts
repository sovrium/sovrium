/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Page-level dataSource binding (Y-5: inline-relationship-create).
 *
 * Re-exports the canonical DataSource schema from `./components/data-source`
 * so it can be imported as a top-level page concept (used in `PageSchema`)
 * without crossing into the components subtree. The underlying schema is
 * shared between page-level (`pages[].dataSource`) and component-level
 * (`pages[].components[].dataSource`) bindings — same shape, same semantics.
 */
export { DataSourceSchema, DataFilterSchema } from './components/data-source'
