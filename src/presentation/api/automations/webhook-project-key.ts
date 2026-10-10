/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Option, Result } from 'effect'
import {
  findIngestProject,
  type IngestProject,
  type IngestProjectSource,
} from '@/application/use-cases/automations/find-ingest-project'
import { runOnRequest } from '@/presentation/api/runtime/run-effect'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Who is sending, for a webhook declaring `auth: { type: projectKey }` — the
 * telemetry counterpart of `resolveWebhookCaller` (`webhook-caller.ts`): an
 * asynchronous identity read from the request's credential, before the body.
 *
 * Two memories, both held per app object — one per server and per config
 * reload — so a reload, or another server booted in the same process, starts
 * empty:
 *
 * - a FOUND sender is trusted for {@link PROJECT_TTL_MS}, so a client
 *   reporting steadily costs one key lookup per half-minute rather than one
 *   per envelope; a key removed from the table stops being accepted within
 *   that time. Past it the entry is kept, as "found within the last
 *   {@link KNOWN_TTL_MS}", but never trusted: it is looked up again;
 * - an UNKNOWN key is remembered for {@link UNKNOWN_TTL_MS}, so repeating it
 *   is refused without reading the table; a key added to the table is
 *   accepted within that time of its first refusal.
 *
 * Each memory holds at most {@link CACHE_CAPACITY} keys and forgets the
 * oldest first (a `Map` iterates in insertion order), so a flood presenting a
 * new random key on every request cannot grow it.
 */

/** How long a found sender is trusted without asking the table again. */
export const PROJECT_TTL_MS = 30_000

/** How long an unknown key is refused without asking the table again. */
export const UNKNOWN_TTL_MS = 30_000

/** How long a found key counts as known (never refused by the refusal budget). */
export const KNOWN_TTL_MS = 600_000

/** The most keys either memory holds. */
export const CACHE_CAPACITY = 1000

interface FoundEntry {
  readonly project: IngestProject
  readonly foundAt: number
}

interface KeyMemory {
  readonly found: Map<string, FoundEntry>
  readonly unknown: Map<string, number>
}

const memories = new WeakMap<App, KeyMemory>()

const memoryOf = (app: App): KeyMemory => {
  const existing = memories.get(app)
  if (existing !== undefined) return existing
  const created: KeyMemory = { found: new Map(), unknown: new Map() }
  memories.set(app, created)
  return created
}

/**
 * Store `value` under `key` as the newest entry, evicting the oldest once the
 * map holds more than {@link CACHE_CAPACITY} (one entry is added at a time).
 */
export const rememberBounded = <V>(map: Map<string, V>, key: string, value: V): void => {
  map.delete(key)
  map.set(key, value)
  if (map.size <= CACHE_CAPACITY) return
  const oldest = map.keys().next()
  if (oldest.done !== true) map.delete(oldest.value)
}

const cacheKeyOf = (source: IngestProjectSource, key: string): string =>
  JSON.stringify([source.table, source.keyField, source.projectField ?? '', key])

/** What a lookup answered: the sender, no sender, or a failure to answer. */
export type ProjectLookup =
  | { readonly status: 'found'; readonly project: IngestProject }
  | { readonly status: 'unknown' }
  | { readonly status: 'failed'; readonly failure: unknown }

/**
 * Whether `key` was found in `source` within the last {@link KNOWN_TTL_MS}.
 * Reads memory only, never the table.
 */
export const isKeyKnown = (
  app: App,
  source: IngestProjectSource,
  key: string,
  now: number = Date.now()
): boolean => {
  const entry = memoryOf(app).found.get(cacheKeyOf(source, key))
  return entry !== undefined && entry.foundAt + KNOWN_TTL_MS > now
}

/** The answer memory alone can give, or `undefined` when the table must be asked. */
const fromMemory = (
  memory: KeyMemory,
  cacheKey: string,
  now: number
): ProjectLookup | undefined => {
  const found = memory.found.get(cacheKey)
  if (found !== undefined && found.foundAt + PROJECT_TTL_MS > now) {
    return { status: 'found', project: found.project }
  }
  const unknownUntil = memory.unknown.get(cacheKey)
  if (unknownUntil !== undefined && unknownUntil > now) return { status: 'unknown' }
  return undefined
}

/** The sender holding `key` in `source`, from memory or the table. */
export const resolveWebhookProject = async (
  c: Context,
  app: App,
  source: IngestProjectSource,
  key: string
): Promise<ProjectLookup> => {
  const memory = memoryOf(app)
  const cacheKey = cacheKeyOf(source, key)
  const now = Date.now()
  const remembered = fromMemory(memory, cacheKey, now)
  if (remembered !== undefined) return remembered
  const lookup = await runOnRequest(c, findIngestProject(source, key))
  if (Result.isFailure(lookup)) return { status: 'failed', failure: lookup.failure }
  if (Option.isNone(lookup.success)) {
    memory.found.delete(cacheKey)
    rememberBounded(memory.unknown, cacheKey, now + UNKNOWN_TTL_MS)
    return { status: 'unknown' }
  }
  const project = lookup.success.value
  memory.unknown.delete(cacheKey)
  rememberBounded(memory.found, cacheKey, { project, foundAt: now })
  return { status: 'found', project }
}

/**
 * Whether the `<project>` segment of a Sentry envelope path names this sender:
 * its `projectField` value when the trigger declares one, else its id.
 */
export const projectMatchesPath = (
  project: IngestProject,
  source: IngestProjectSource,
  segment: string
): boolean => {
  const value = source.projectField === undefined ? project.id : project[source.projectField]
  return value !== undefined && value !== null && String(value) === segment
}
