/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Layer } from 'effect'
import { GitOperationsLive } from '../services/git-operations'
import { ForgejoApiLive } from '../services/vcs-api'

export const LiveLayer = GitOperationsLive.pipe(Layer.provideMerge(ForgejoApiLive))
