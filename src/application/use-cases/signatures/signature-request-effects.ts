/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What every move of a signing request does beside its own transaction: the
 * status the flow writes back into the record, and the links mailed to the
 * signers it invites.
 *
 * The status is written through the move's writer, as the engine: the update
 * road for a signer or the sweep (`road-record-writer.ts`), the run's channel
 * for a step. The value carries the flow's mark (`engineWrittenFlowOutput`), which is how the
 * road tells it from a client write to the same field, refused. The record's
 * automations and webhooks see it as any other update.
 *
 * A link is mailed straight to its signer through the operator's transport:
 * its token never passes through a run, a log or a response.
 */

import { DateTime, Effect } from 'effect'
import { EmailSender } from '@/application/ports/services/email-sender'
import { ProcessEnv } from '@/application/ports/services/process-env'
import { ServerOrigin } from '@/application/ports/services/server-origin'
import { engineWrittenFlowOutput } from '@/application/use-cases/tables/signature-write-once-check'
import { escapeHtmlAttribute } from '@/domain/kernel/sanitize/html-escaping'
import { durationToMs } from '@/domain/kernel/time/parse-duration'
import { displayNameOf } from '@/domain/models/app/display-name-service'
import { evidenceKeepUntil } from '@/domain/models/app/signatures/signature-evidence-chain-service'
import { signingLinkPath } from '@/domain/models/app/signatures/signature-request-service'
import { readSovriumDevClock } from '@/domain/models/process-env/dev-clock'
import type { InvitedSigner } from '@/application/ports/repositories/signatures/signature-request-repository'
import type { App } from '@/domain/models/app'
import type { RequestStatus } from '@/domain/models/app/signatures/signature-request-service'

/** One declared flow of the app. */
export type SignatureFlowOf = NonNullable<App['signatures']>[number]

/**
 * The current instant, in epoch milliseconds and ISO 8601: the instant a
 * development server is pinned to by `SOVRIUM_DEV_CLOCK`, else the clock's.
 */
export const nowInstant = Effect.gen(function* () {
  const pinned = readSovriumDevClock(yield* ProcessEnv)
  const now = pinned === undefined ? yield* DateTime.now : DateTime.makeUnsafe(pinned)
  return { ms: DateTime.toEpochMillis(now), iso: DateTime.formatIso(now) }
}).pipe(Effect.withSpan('signatures.now'))

/** When the evidence of a request ending at `endedAtMs` may go; a year when `keep` does not read. */
export const keepUntilFor = (flow: SignatureFlowOf | undefined, endedAtMs: number): number =>
  evidenceKeepUntil(endedAtMs, flow?.evidence.keep ?? '') ?? endedAtMs + (durationToMs('1y') ?? 0)

/** One write of engine-authored values into a record. */
export interface FlowRecordWrite {
  readonly app: App
  readonly tableName: string
  readonly recordId: string
  readonly fields: Readonly<Record<string, unknown>>
}

/**
 * How a move writes into its record: through the update road with the
 * record's automations started in the background (a signer, the sweep), or
 * through the run's channel (a step), which bounds a chain of runs.
 */
export type FlowRecordWriter<R> = (write: FlowRecordWrite) => Effect.Effect<unknown, unknown, R>

/**
 * Write `status` into the flow's status field of the record, as the engine,
 * with the output `files` a completion writes (field name to storage key) in
 * the same update. Nothing when there is neither. A record deleted since
 * keeps the request's own status, which is the authoritative one.
 */
export const writeFlowStatus = <R>(
  writer: FlowRecordWriter<R>,
  target: { readonly app: App; readonly flow: SignatureFlowOf; readonly recordId: string },
  status: RequestStatus,
  files: Readonly<Record<string, string>> = {}
) => {
  const field = target.flow.output.status
  const values: Readonly<Record<string, unknown>> = {
    ...files,
    ...(field === undefined ? {} : { [field]: status }),
  }
  if (Object.keys(values).length === 0) return Effect.void
  return writer({
    ...{ app: target.app, tableName: target.flow.table, recordId: target.recordId },
    fields: Object.fromEntries(
      Object.entries(values).map(([name, value]) => [name, engineWrittenFlowOutput(value)])
    ),
  }).pipe(
    Effect.asVoid,
    Effect.tapCause((cause) =>
      Effect.logWarning('A signing flow could not write its status into the record', cause)
    ),
    // effect-swallow: the request row holds the status that counts; a record deleted or locked meanwhile must not undo the move already committed.
    Effect.ignoreCause,
    Effect.withSpan('signatures.write-flow-status', { attributes: { status } })
  )
}

/** The page a flow's links open, its path as declared. */
export const signingPagePath = (app: App, flow: SignatureFlowOf): string | undefined => {
  const path = app.pages?.find((page) => page.name === flow.surface.page)?.path
  return typeof path === 'string' ? path : undefined
}

/** The invitation one signer receives: neutral words, the link, and when it stops working. */
const invitationMail = (input: {
  readonly appName: string
  readonly displayName: string
  readonly link: string
  readonly expiresAt: string | undefined
}) => {
  const until =
    input.expiresAt === undefined
      ? ''
      : ` It stops working on ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(input.expiresAt))}.`
  const greeting = input.displayName === '' ? 'Hello,' : `Hello ${input.displayName},`
  return {
    subject: `${input.appName}: a document is waiting for your signature`,
    text: `${greeting}\n\nA document is waiting for your signature. Open it and sign here:\n${input.link}\n\nThis link is yours alone: do not forward it.${until}`,
    html: `<p>${escapeHtmlAttribute(greeting)}</p><p>A document is waiting for your signature.</p><p><a href="${escapeHtmlAttribute(input.link)}">Open the document and sign</a></p><p>This link is yours alone: do not forward it.${escapeHtmlAttribute(until)}</p>`,
  }
}

/** Mail each invited signer her link. A link that cannot be built or sent is logged, never shown. */
export const mailSigningLinks = Effect.fn('signatures.mail-signing-links')(function* (input: {
  readonly app: App
  readonly flow: SignatureFlowOf
  readonly invited: readonly InvitedSigner[]
  readonly expiresAt: string | undefined
}) {
  const path = signingPagePath(input.app, input.flow)
  if (path === undefined || input.invited.length === 0) return
  const origin = yield* (yield* ServerOrigin).current
  const mailer = yield* EmailSender
  yield* Effect.forEach(
    input.invited,
    (signer) =>
      mailer
        .send({
          to: signer.email,
          fromName: displayNameOf(input.app),
          ...invitationMail({
            ...{ appName: displayNameOf(input.app), displayName: signer.displayName },
            link: `${origin}${signingLinkPath(path, signer.token)}`,
            expiresAt: input.expiresAt,
          }),
        })
        .pipe(
          Effect.tapCause((cause) =>
            Effect.logError(`The signing link of ${signer.name} could not be mailed`, cause)
          ),
          // effect-swallow: the request is open and its evidence written; a transport failure is logged for the operator, who may resend.
          Effect.catchCause(() => Effect.void)
        ),
    { discard: true }
  )
})
