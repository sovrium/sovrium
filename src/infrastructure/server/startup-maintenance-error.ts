/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createTaggedError } from '@/domain/errors/create-tagged-error'

/**
 * Error class for a best-effort startup step that did not complete.
 *
 * Covers the deferred maintenance passes (attachment-URL repair, storage-bucket
 * attribution, RAG knowledge startup, link shadow sweep) and the key-material
 * survey that feeds the startup banner. None of them may fail a boot: by the
 * time they run the listener is bound and the database is migrated.
 *
 * It exists so that they fail as a NAMED outcome the surrounding chain expects,
 * rather than as a defect — which skipped the remaining steps of the chain and
 * reported a maintenance pass as a runtime panic.
 */
export const StartupMaintenanceError = createTaggedError('StartupMaintenanceError')
export type StartupMaintenanceError = InstanceType<typeof StartupMaintenanceError>
