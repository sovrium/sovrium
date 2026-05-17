/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import { ImageTransformServiceLive } from './image-transform-live'
import { StorageServiceLive } from './storage-service-live'

export const StorageLive = Layer.merge(StorageServiceLive, ImageTransformServiceLive)
