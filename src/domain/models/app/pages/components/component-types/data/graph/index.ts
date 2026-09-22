/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// ONE path out, deliberately: `fields.ts` re-exports every sub-schema, so the
// barrel names `./fields` alone. Naming `./schema` here as well would publish
// each binding down two paths — the shape `chart` avoids two directories over,
// and the one that makes a later rename look local when it is not.
export * from './fields'
