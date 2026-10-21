/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A run's two file ledgers (`run-written-files.ts`) across a pause.
 *
 * A run that pauses — on an approval, a browser step's confirmation, a long
 * wait — ends its segment, and the segment that resumes it builds a fresh
 * step context. Without its ledgers that segment would forget every file the
 * run stored before the pause (and a step writing as nobody could no longer
 * attach them), and every key it read from a record. So the pausing segment
 * stores both with the run, and the resuming one restores them — with what a
 * browser step that paused in its middle had read (`parked-step-files.ts`).
 *
 * Each entry is stored with a fingerprint of the object at its key, taken as
 * the run pauses, which names its kind:
 *
 * - `stat:<provider>:…` — the store's own identity of the object, read with
 *   one metadata call (`StorageService.objectIdentity`);
 * - `sha256:<size>:<hex>` — the bytes hashed, where the store gives no such
 *   identity;
 * - `absent` — nothing stored there;
 * - `unknown` — the store could not say, which matches nothing.
 *
 * On resume the fingerprint is taken again, of the same kind, and an entry
 * whose object changed meanwhile — or that the store cannot vouch for — is
 * dropped: a resume never lends the run's standing to bytes someone else
 * wrote while it waited. What is restored is never more than what was
 * recorded; a stored value that does not read as a ledger restores nothing.
 */

import { createHash } from 'node:crypto'
import { Effect, Option, Schema } from 'effect'
import {
  isStorageObjectNotFound,
  StorageService,
} from '@/application/ports/services/storage-service'
import { logStorageFailure } from '@/application/use-cases/storage/storage-failure-log'
import {
  createParkedStepCell,
  type ParkedStepCell,
  type ParkedStepFiles,
} from '../action-handlers/parked-step-files'
import {
  createRunWrittenFiles,
  type RunWrittenEntry,
  type RunWrittenFiles,
} from '../action-handlers/run-written-files'
import type { StepFileInput } from '../action-handlers/step-file-inputs'

/** A stored ledger entry: the entry, and the fingerprint of its object at the pause. */
export interface StoredLedgerEntry extends RunWrittenEntry {
  readonly fingerprint: string
}

/** What a paused run stores: both ledgers, entry by entry, and a paused step's reading. */
export interface StoredRunLedgers {
  readonly v: 1
  readonly written: readonly StoredLedgerEntry[]
  readonly read: readonly StoredLedgerEntry[]
  readonly parked?: ParkedStepFiles
}

/** A run's two ledgers, and the paused-step cell, as a step context holds them. */
export interface RunLedgers {
  readonly writtenFiles: RunWrittenFiles
  readonly readFiles: RunWrittenFiles
  readonly parkedStep?: ParkedStepCell
}

/** The fingerprint of no object at a key. */
export const ABSENT_FINGERPRINT = 'absent'

/** The fingerprint of an object the store could not vouch for: it matches nothing. */
export const UNKNOWN_FINGERPRINT = 'unknown'

/** The fingerprint of an object's bytes: their size and their SHA-256. */
export const fingerprintOf = (bytes: Uint8Array): string =>
  `sha256:${String(bytes.length)}:${createHash('sha256').update(bytes).digest('hex')}`

/** How a fingerprint is taken: the store's identity when it has one, or the bytes hashed. */
type FingerprintKind = 'identity' | 'sha256'

/**
 * The kind a stored fingerprint must be compared in: a hash (typed, or an
 * untyped `<size>:<hex>`) is hashed again; an identity, or `absent`, is read
 * the way the pause read it.
 */
export const kindOf = (fingerprint: string): FingerprintKind =>
  fingerprint.startsWith('stat:') || fingerprint === ABSENT_FINGERPRINT ? 'identity' : 'sha256'

/**
 * The hash of the object at `key`, or `absent` / `unknown` when it cannot be
 * read. The store hashes while it reads, so an object of any size is
 * fingerprinted in constant memory and never held whole.
 */
const hashAt = (key: string): Effect.Effect<string, never, StorageService> =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    const hashed = yield* Effect.result(storage.hashObject(key))
    if (hashed._tag === 'Success') {
      return `sha256:${String(hashed.success.size)}:${hashed.success.sha256}`
    }
    const sized = yield* Effect.result(storage.statObject(key))
    return sized._tag === 'Failure' && isStorageObjectNotFound(sized.failure)
      ? ABSENT_FINGERPRINT
      : UNKNOWN_FINGERPRINT
  })

/**
 * The fingerprint of the object at `key` now: the store's identity when it
 * gives one (or the bytes hashed when it does not, or when `kind` asks for a
 * hash), `absent` when nothing is there, `unknown` when the store cannot say.
 */
export const fingerprintAt = (
  key: string,
  kind: FingerprintKind = 'identity'
): Effect.Effect<string, never, StorageService> =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    if (kind === 'sha256') return yield* hashAt(key)
    // effect-swallow: fail-soft — a store that cannot say what is at the key yields the `unknown` fingerprint, which the ledger already treats as unproven; the cause is logged on the way.
    const identity = yield* Effect.result(
      storage
        .objectIdentity(key)
        .pipe(
          logStorageFailure(
            '[automations] the run ledger could not read an object identity; recording it as unknown',
            { 'sovrium.storage.key': key }
          )
        )
    )
    if (identity._tag === 'Failure') return UNKNOWN_FINGERPRINT
    const known = identity.success
    if (known.kind === 'absent') return ABSENT_FINGERPRINT
    return known.kind === 'identity' ? `stat:${known.value}` : yield* hashAt(key)
  }).pipe(Effect.withSpan('automations.ledger-fingerprint-at'))

/** The fingerprints of `keys` taken in `kind`, each read once, by key. */
const fingerprintsOf = (
  keys: readonly { readonly key: string; readonly kind: FingerprintKind }[]
): Effect.Effect<ReadonlyMap<string, string>, never, StorageService> => {
  const unique = [...new Map(keys.map((entry) => [`${entry.kind}|${entry.key}`, entry])).values()]
  return Effect.map(
    Effect.forEach(unique, ({ key, kind }) =>
      Effect.map(fingerprintAt(key, kind), (print) => [`${kind}|${key}`, print] as const)
    ),
    (pairs) => new Map(pairs)
  )
}

const keysOf = (ledgers: readonly (readonly RunWrittenEntry[])[]): readonly string[] =>
  ledgers.flatMap((entries) => entries.map((entry) => entry.key))

/** Both ledgers as a paused run stores them, each entry fingerprinted now. */
export const snapshotRunLedgers = (ledgers: {
  readonly writtenFiles?: RunWrittenFiles | undefined
  readonly readFiles?: RunWrittenFiles | undefined
  readonly parkedStep?: ParkedStepCell | undefined
}): Effect.Effect<StoredRunLedgers, never, StorageService> =>
  Effect.gen(function* () {
    const written = ledgers.writtenFiles?.entries() ?? []
    const read = ledgers.readFiles?.entries() ?? []
    const keys = keysOf([written, read]).map((key) => ({ key, kind: 'identity' as const }))
    const prints = yield* fingerprintsOf(keys)
    const stored = (entry: RunWrittenEntry): StoredLedgerEntry => ({
      ...entry,
      fingerprint: prints.get(`identity|${entry.key}`) ?? UNKNOWN_FINGERPRINT,
    })
    const parked = ledgers.parkedStep?.peek()
    return {
      v: 1,
      written: written.map(stored),
      read: read.map(stored),
      ...(parked === undefined ? {} : { parked }),
    } as const
  }).pipe(Effect.withSpan('automations.snapshot-run-ledgers'))

/** One stored entry as it is read back: any standing that is not exactly `true` reads as none. */
const StoredLedgerEntrySchema = Schema.Struct({
  bucket: Schema.NullOr(Schema.String),
  key: Schema.NonEmptyString,
  carriesRunBytes: Schema.optionalKey(Schema.Unknown),
  fingerprint: Schema.String,
})

/** One input a paused step had read: a stored key, or a standing of its own; never both. */
const StoredStepInputSchema = Schema.Struct({
  label: Schema.String,
  key: Schema.optionalKey(Schema.NonEmptyString),
  carriesRunBytes: Schema.optionalKey(Schema.Boolean),
  record: Schema.optionalKey(
    Schema.Struct({ table: Schema.String, recordId: Schema.String, field: Schema.String })
  ),
})

/** A paused step's reading as stored; an input that does not read as one is a refused one. */
const StoredParkedSchema = Schema.Struct({
  inputs: Schema.Array(Schema.Unknown),
  sawOwnApp: Schema.optionalKey(Schema.Unknown),
})

/** The envelope a paused run stores; each ledger in it is read entry by entry. */
const StoredLedgersEnvelopeSchema = Schema.Struct({
  v: Schema.Literal(1),
  written: Schema.optionalKey(Schema.Unknown),
  read: Schema.optionalKey(Schema.Unknown),
  parked: Schema.optionalKey(Schema.Unknown),
})

const decodeEntry = Schema.decodeUnknownOption(StoredLedgerEntrySchema)
const decodeEntries = Schema.decodeUnknownOption(Schema.Array(Schema.Unknown))
const decodeInput = Schema.decodeUnknownOption(StoredStepInputSchema)
const decodeParked = Schema.decodeUnknownOption(StoredParkedSchema)
const decodeEnvelope = Schema.decodeUnknownOption(
  Schema.Union([Schema.fromJsonString(StoredLedgersEnvelopeSchema), StoredLedgersEnvelopeSchema])
)

/** The entries of one stored ledger; a malformed entry, or a ledger that is no list, is left out. */
const entriesOf = (value: unknown): readonly StoredLedgerEntry[] =>
  Option.getOrElse(decodeEntries(value), () => []).flatMap((item) =>
    Option.match(decodeEntry(item), {
      onNone: () => [],
      onSome: ({ bucket, key, carriesRunBytes, fingerprint }) => [
        { bucket, key, carriesRunBytes: carriesRunBytes === true, fingerprint },
      ],
    })
  )

/** One stored step input; one that does not read as an input gives no standing. */
const inputOf = (value: unknown): StepFileInput =>
  Option.match(decodeInput(value), {
    onNone: () => ({ label: 'a file the paused step read', carriesRunBytes: false }),
    onSome: ({ label, key, carriesRunBytes, record }) => ({
      label,
      ...(record === undefined ? {} : { record }),
      ...(key === undefined ? { carriesRunBytes: carriesRunBytes === true } : { key }),
    }),
  })

/** A paused step's stored reading; the taint holds unless it reads exactly `false`. */
const parkedOf = (value: unknown): ParkedStepFiles | undefined =>
  value === undefined
    ? undefined
    : Option.match(decodeParked(value), {
        onNone: () => ({ inputs: [], sawOwnApp: true }),
        onSome: ({ inputs, sawOwnApp }) => ({
          inputs: inputs.map(inputOf),
          sawOwnApp: sawOwnApp !== false,
        }),
      })

/** A stored value (or its JSON text) read as a run's ledgers; anything else reads as two empty ones. */
export const parseStoredRunLedgers = (raw: unknown): StoredRunLedgers =>
  Option.match(decodeEnvelope(raw), {
    onNone: () => ({ v: 1, written: [], read: [] }) as const,
    onSome: (stored) => {
      const parked = parkedOf(stored.parked)
      return {
        v: 1,
        written: entriesOf(stored.written),
        read: entriesOf(stored.read),
        ...(parked === undefined ? {} : { parked }),
      } as const
    },
  })

/** The key a fingerprint taken now in `stored`'s kind is filed under. */
const nowKeyOf = (entry: StoredLedgerEntry): string => `${kindOf(entry.fingerprint)}|${entry.key}`

/** The fingerprint a legacy untyped hash stands for. */
const typed = (fingerprint: string): string =>
  /^\d+:[0-9a-f]{64}$/.test(fingerprint) ? `sha256:${fingerprint}` : fingerprint

/**
 * The entries whose object is as it was at the pause, without their
 * fingerprints. `now` holds the fingerprints taken again, by kind and key; an
 * `unknown` one, then or now, matches nothing.
 */
export const unchangedEntries = (
  entries: readonly StoredLedgerEntry[],
  now: ReadonlyMap<string, string>
): readonly RunWrittenEntry[] =>
  entries
    .filter((entry) => {
      const stored = typed(entry.fingerprint)
      return stored !== UNKNOWN_FINGERPRINT && now.get(nowKeyOf(entry)) === stored
    })
    .map(({ bucket, key, carriesRunBytes }) => ({ bucket, key, carriesRunBytes }))

/**
 * The ledgers a resuming segment starts with: the stored ones, less every
 * entry whose object changed while the run waited, and the paused step's
 * reading. Nothing stored: empty.
 */
export const restoreRunLedgers = (raw: unknown): Effect.Effect<RunLedgers, never, StorageService> =>
  Effect.gen(function* () {
    const stored = parseStoredRunLedgers(raw)
    // An entry the pause could not vouch for is dropped without asking the store again.
    const entries = [...stored.written, ...stored.read].filter(
      (entry) => entry.fingerprint !== UNKNOWN_FINGERPRINT
    )
    const now = yield* fingerprintsOf(
      entries.map((entry) => ({ key: entry.key, kind: kindOf(entry.fingerprint) }))
    )
    return {
      writtenFiles: createRunWrittenFiles(unchangedEntries(stored.written, now)),
      readFiles: createRunWrittenFiles(unchangedEntries(stored.read, now)),
      parkedStep: createParkedStepCell(stored.parked),
    }
  }).pipe(Effect.withSpan('automations.restore-run-ledgers'))

/** Whether a run ending its segment with `status` pauses, and so stores its ledgers. */
export const pausesWithLedgers = (status: string): boolean =>
  status === 'waiting-approval' || status === 'waiting-delay'

/** The `filesLedger` a run ending its segment with `status` stores: its ledgers when it pauses. */
export const pausedLedgerOverlay = (
  status: string,
  ledgers: Parameters<typeof snapshotRunLedgers>[0]
): Effect.Effect<{ readonly filesLedger?: StoredRunLedgers }, never, StorageService> =>
  (pausesWithLedgers(status)
    ? Effect.map(snapshotRunLedgers(ledgers), (filesLedger) => ({ filesLedger }))
    : Effect.succeed({})
  ).pipe(Effect.withSpan('automations.paused-ledger-overlay'))
