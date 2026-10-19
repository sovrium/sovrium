/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Ref } from 'effect'
import {
  isCreateOnlyRefusal,
  StorageService,
  uploadTargetParts,
} from '@/application/ports/services/storage-service'
import { resolveTranscribeSource } from './ai-transcribe-source'
import { isSelfContainedSource } from './file-support'
import { CALLER_REFUSAL } from './record-caller-gate'
import { actionAttributes, stringProp } from './shared'
import { firstStarterRefusal, starterFileGate, starterRemovalGate } from './starter-file-gate'
import { starterOverwriteVerdict } from './starter-overwrite-gate'
import type { ActionHandler, ActionOutcome, AutomationContext } from './shared'
import type { App } from '@/domain/models/app'

/**
 * THE `file` OPERATORS THAT READ, REMOVE OR WRITE OVER A STORED FILE BY KEY,
 * behind the gates of `starter-file-gate.ts`: in a run someone started by
 * hand, each key is judged before the handler runs, as its starter may read
 * it, remove it, or write over it.
 */

type Props = Readonly<Record<string, unknown>>

/** `props[name]` when set, else `props[fallback]`: the handlers' own `key ?? source` reading. */
const keyOr = (p: Props, name: string, fallback: string): string =>
  p[name] !== undefined ? stringProp(p, name) : stringProp(p, fallback)

/** The first non-empty of `names`, as `parseXlsx` reads `source ?? key`. */
const firstSet = (p: Props, names: readonly string[]): string =>
  names.map((name) => (p[name] !== undefined ? stringProp(p, name) : '')).find(Boolean) ?? ''

/**
 * The keys each gated operator reads, read off its props exactly as its
 * handler reads them. An upload's `source` names a stored file unless it is a
 * `data:` URI or a URL, which {@link storedKeys} drops. `list` is gated by
 * {@link gatedFileList}; `generateCsv` and an upload link read no stored file.
 */
const STORED_KEYS: Readonly<Record<string, (p: Props) => readonly unknown[]>> = {
  upload: (p) => [stringProp(p, 'source')],
  getMetadata: (p) => [stringProp(p, 'key')],
  download: (p) => [stringProp(p, 'key')],
  copy: (p) => [stringProp(p, 'sourceKey')],
  move: (p) => [stringProp(p, 'sourceKey')],
  signUrl: (p) => (p['operation'] === 'upload' ? [] : [stringProp(p, 'key')]),
  parseCsv: (p) =>
    typeof p['content'] === 'string' && p['content'] !== '' ? [] : [keyOr(p, 'key', 'source')],
  parseXlsx: (p) => [firstSet(p, ['source', 'key'])],
  extractText: (p) => [keyOr(p, 'key', 'source')],
  transformImage: (p) => [keyOr(p, 'key', 'source')],
  // An attachment object renders as "[object Object]", which names no key: the
  // handler judges the key it resolves to instead.
  extractAudio: (p) => [resolveTranscribeSource(stringProp(p, 'source'), undefined)?.key],
  compress: (p) => {
    const keys = p['keys'] ?? p['files']
    return Array.isArray(keys) ? keys.map(String) : []
  },
}

/**
 * The keys each gated operator REMOVES, read off its props as its handler
 * reads them: a delete's key, a move's source. They are judged by
 * {@link starterRemovalGate}: removing is not reading. A move's source is read
 * too, so it is judged by both gates.
 */
const REMOVED_KEYS: Readonly<Record<string, (p: Props) => readonly unknown[]>> = {
  delete: (p) => [stringProp(p, 'key')],
  move: (p) => [stringProp(p, 'sourceKey')],
}

/**
 * The keys each gated operator WRITES over, read off its props as its handler
 * reads them: a copy's or a move's destination, an upload link's key, the
 * `destination` a CSV, an archive or a transformed image is written to. A
 * `file/upload` keeps its own taken-key rule (`uploadPlacement`).
 */
const WRITTEN_KEYS: Readonly<Record<string, (p: Props) => readonly unknown[]>> = {
  copy: (p) => [stringProp(p, 'destinationKey')],
  move: (p) => [stringProp(p, 'destinationKey')],
  signUrl: (p) => (p['operation'] === 'upload' ? [stringProp(p, 'key')] : []),
  generateCsv: (p) => [stringProp(p, 'destination')],
  compress: (p) => [stringProp(p, 'destination')],
  transformImage: (p) => [stringProp(p, 'destination')],
  extractAudio: (p) => [stringProp(p, 'destination')],
}

/** The operators whose missing file fails the step; the others report it in `output.error`. */
const FAILS_THE_STEP: ReadonlySet<string> = new Set(['delete', 'parseXlsx', 'extractAudio'])

/** The stored keys among `refs`: a `data:` URI or a URL carries its own bytes. */
const storedKeys = (refs: readonly unknown[]): readonly string[] =>
  refs.filter(
    (ref): ref is string => typeof ref === 'string' && ref !== '' && !isSelfContainedSource(ref)
  )

/** A refusal in the operator's own shape: a failed step, or a soft `output.error`. */
const refusedAs = (operator: string, refusal: string): ActionOutcome =>
  FAILS_THE_STEP.has(operator)
    ? { status: 'failure', error: refusal }
    : { status: 'success', output: { error: refusal } }

/** The keys `table` names for `operator` in `p`, stored keys only. */
const keysOf = (
  table: Readonly<Record<string, (p: Props) => readonly unknown[]>>,
  operator: string,
  p: Props
): readonly string[] => storedKeys((table[operator] ?? (() => []))(p))

/**
 * `storage`, writing create-only at `keys`: a write there replaces nothing, and
 * one that finds a file stored in the meantime marks `taken` and is kept.
 */
const createOnlyAt = (
  storage: Effect.Success<typeof StorageService>,
  keys: ReadonlySet<string>,
  taken: Ref.Ref<boolean>
): Effect.Success<typeof StorageService> =>
  StorageService.of({
    ...storage,
    upload: (key, content, mimeType, target) =>
      keys.has(key)
        ? storage
            .upload(key, content, mimeType, { ...uploadTargetParts(target), mode: 'create-only' })
            .pipe(
              Effect.tapError((error) =>
                isCreateOnlyRefusal(error) ? Ref.set(taken, true) : Effect.void
              )
            )
        : storage.upload(key, content, mimeType, target),
  })

/**
 * The destinations of `operator` in `p`, each judged by
 * {@link starterOverwriteVerdict}: the first refusal, or the keys found free,
 * which the handler then writes create-only.
 */
const judgeDestinations = (app: App, automation: AutomationContext, keys: readonly string[]) =>
  Effect.forEach(keys, (key) =>
    Effect.map(starterOverwriteVerdict(app, automation)(key), (verdict) => ({ key, verdict }))
  ).pipe(
    Effect.map((judged): { readonly refusal: string } | { readonly free: ReadonlySet<string> } => {
      const refused = judged.find(({ verdict }) => verdict.kind === 'refused')?.verdict
      if (refused?.kind === 'refused') return { refusal: refused.refusal }
      const free = judged.filter(({ verdict }) => verdict.kind === 'free').map(({ key }) => key)
      return { free: new Set(free) }
    })
  )

/**
 * `handler`, the `file/<operator>` step, behind the gates: in a run started by
 * hand, a key the read gate refuses, a key {@link starterRemovalGate} refuses
 * to remove, or a destination {@link starterOverwriteVerdict} refuses, answers
 * the refusal and the handler never runs. A destination found free is written
 * create-only: a file stored there in the meantime is kept, and the step
 * answers the refusal.
 */
export const gatedFileOperator =
  (operator: string, handler: ActionHandler): ActionHandler =>
  (action, app, automation, runContext) =>
    Effect.gen(function* () {
      const p = (action['props'] as Props | undefined) ?? {}
      // Judged before any byte is read: a refused step reads, writes and removes nothing.
      const gates = [
        [starterFileGate, STORED_KEYS],
        [starterRemovalGate, REMOVED_KEYS],
      ] as const
      const refusal = yield* Effect.reduce(
        gates,
        (): string | undefined => undefined,
        (found, [gate, table]) =>
          found === undefined
            ? firstStarterRefusal(gate(app, automation), keysOf(table, operator, p))
            : Effect.succeed(found)
      )
      if (refusal !== undefined) return refusedAs(operator, refusal)
      const destinations = yield* judgeDestinations(
        app,
        automation,
        keysOf(WRITTEN_KEYS, operator, p)
      )
      if ('refusal' in destinations) return refusedAs(operator, destinations.refusal)
      if (destinations.free.size === 0) return yield* handler(action, app, automation, runContext)
      const taken = yield* Ref.make(false)
      const storage = yield* StorageService
      const outcome = yield* handler(action, app, automation, runContext).pipe(
        Effect.provideService(StorageService, createOnlyAt(storage, destinations.free, taken))
      )
      return (yield* Ref.get(taken)) ? refusedAs(operator, CALLER_REFUSAL) : outcome
    }).pipe(
      Effect.withSpan('automations.gated-file-operator', { attributes: actionAttributes(action) })
    )
