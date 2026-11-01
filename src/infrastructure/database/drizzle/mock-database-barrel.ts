/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Test support: the ONE sanctioned way to `mock.module()` the
 * `@/infrastructure/database` barrel. Imported only by `*.test.ts` files.
 *
 * Bun patches a mocked module's exports IN PLACE and writes re-exported
 * bindings through to their source, so a hand-rolled barrel mock leaks twice
 * over: a stand-in class reaches the leaf module (`DatabaseError` without
 * `_tag`, so `catchTag('DatabaseError')` stops matching for the rest of the
 * process), and a restore taken from the mocked `import * as` namespace
 * re-installs the fake. This helper builds the genuine surface from the DEEP
 * modules — which nothing mocks — once, at load, as a plain snapshot; every
 * install is `{ ...REAL, ...overrides }` and every restore is `REAL`.
 * `sovrium/no-mock-module-for-app-modules` fails a barrel mock anywhere else.
 */

import { afterAll, mock } from 'bun:test'
import * as errors from '../errors'
import * as layer from './layer'
import * as schema from './schema'
import type * as Barrel from '@/infrastructure/database'

/** The genuine barrel surface, snapshotted before any mock can patch it. */
const REAL: Readonly<Record<string, unknown>> = Object.freeze({
  ...schema,
  ...layer,
  ...errors,
})

/** Overrides keyed by real barrel exports only, so a typo fails typecheck. */
export type DatabaseBarrelOverrides = Readonly<Partial<Record<keyof typeof Barrel, unknown>>>

/**
 * Install `{ ...real, ...overrides }` as the barrel and return its restore,
 * which reinstalls the snapshot (idempotent). Registers no hook — prefer
 * {@link mockDatabaseBarrel}; this half exists for the helper's own test.
 */
export const installDatabaseBarrelMock = (overrides: DatabaseBarrelOverrides): (() => void) => {
  mock.module('@/infrastructure/database', () => ({ ...REAL, ...overrides }))
  return () => {
    mock.module('@/infrastructure/database', () => REAL)
  }
}

/**
 * Mock the database barrel for the calling file (or `describe`) and restore the
 * genuine surface in `afterAll`. Call it at the top level, BEFORE dynamically
 * importing the module under test.
 */
export const mockDatabaseBarrel = (overrides: DatabaseBarrelOverrides): (() => void) => {
  const restore = installDatabaseBarrelMock(overrides)
  afterAll(restore)
  return restore
}
