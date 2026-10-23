/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { AppSeedActionSchema } from './seed'

/**
 * App Action — operators an app runs on ITSELF: its own data, its own
 * accounts, its own files. `seed` loads the app's own seed files, or resets
 * the app to them. Where `instance/*` supervises other apps on a host, `app/*`
 * never reaches outside the app it runs in.
 */
export const AppActionSchema = AppSeedActionSchema

/** @public */
export type AppAction = typeof AppActionSchema.Type
