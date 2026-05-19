/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Layer } from 'effect'
import { db, type DrizzleDB } from './db.js'

export class Database extends Context.Tag('Database')<Database, DrizzleDB>() {}

export const DatabaseLive = Layer.succeed(Database, db)
