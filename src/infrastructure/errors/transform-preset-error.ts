/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createTaggedError } from '@/domain/errors/create-tagged-error'

export const TransformPresetError = createTaggedError('TransformPresetError')
export type TransformPresetError = InstanceType<typeof TransformPresetError>
