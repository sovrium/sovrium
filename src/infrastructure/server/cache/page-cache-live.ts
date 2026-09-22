/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import { PageCache } from '@/application/ports/services/page-cache'
import { getCachedPage, setCachedPage } from './page-cache-service'

/**
 * The process-local page store behind the read/write port.
 *
 * A two-line adapter, and deliberately nothing more: the `Ref`, the byte
 * budget, the eviction order and the occupancy telemetry stay in
 * `page-cache-service.ts`, which the static build and the hot-reload path also
 * call directly. A second store with its own copy of the admission rule is how
 * two surfaces start disagreeing about what is cached.
 *
 * `Layer.succeed` rather than `Layer.effect`: the store is a module-level
 * singleton with no acquisition step and no lifetime of its own, so there is
 * nothing to build and nothing to release. Its state is process-global on
 * purpose — see the store's own docblock — and binding it per runtime would
 * hand each `ManagedRuntime` a private view of a cache whose whole value is
 * being shared.
 */
export const PageCacheLive = Layer.succeed(PageCache, {
  get: getCachedPage,
  set: setCachedPage,
})
