/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The routes of signing requests.
 *
 * For whoever may read the record a request is for:
 *
 * - `GET /api/signatures/requests/:requestId` — where the request stands: its
 *   status, its document hash and each signer's status, no contact data;
 *   anyone else gets 404.
 *
 * For the holder of a signing link, anonymous by design: the signing page's
 * link is exchanged for a session and the page renders in it, its frozen
 * document served at `GET /api/signatures/document` (`signing-page-gate.ts`);
 * `POST /api/signatures/sign` and `POST /api/signatures/decline` act in it
 * (`signing-session-handlers.ts`), and `POST /api/signatures/challenge` sends
 * its signer a one-time code when the flow verifies (`challenge-handlers.ts`).
 * Those three refuse a post from another site, and the link road closes to an
 * address that keeps guessing.
 *
 * For a signer of a completed request, anonymous by design and bound to her
 * by the token in its path: `GET /api/signatures/deliveries/:token/:file`
 * answers her copy of the signed document or of the proof file. Any token
 * that is not hers, live, on a completed request, gets the same 404.
 *
 * The evidence routes, all for administrators:
 *
 * - `GET /api/signatures/requests/:requestId/evidence` — the evidence file
 *   (`evidence.json`): the chain of events, the signers by identity kind and
 *   commitment, never a contact in clear;
 * - `GET /api/signatures/requests/:requestId/export` — the export bundle, the
 *   evidence file and every file it covers, which `sovrium signature verify`
 *   checks with no server involved;
 * - `POST /api/signatures/requests/:requestId/erasures` — erase one signer on
 *   her request: her contact data and salts deleted, her cell redacted, an
 *   `erased` event appended.
 *
 * A caller who is not an administrator, and a request that does not exist,
 * get the same 404 (anti-enumeration).
 */

import { Effect } from 'effect'
import {
  buildSignatureExport,
  readSignatureEvidence,
} from '@/application/use-cases/signatures/build-signature-export'
import { readDeliveredDocument } from '@/application/use-cases/signatures/deliver-signed-documents'
import { eraseSignatureSigner } from '@/application/use-cases/signatures/erase-signature-signer'
import { readSignatureRequestStatus } from '@/application/use-cases/signatures/read-signature-request'
import { DELIVERY_ROUTE_PATH } from '@/domain/models/api/signatures/deliveries'
import {
  erasureRequestSchema,
  erasureResponseSchema,
} from '@/domain/models/api/signatures/erasures'
import { evidenceFileSchema } from '@/domain/models/api/signatures/evidence'
import { exportManifestSchema } from '@/domain/models/api/signatures/export'
import { signatureRequestResponseSchema } from '@/domain/models/api/signatures/requests'
import { MAX_SIGNATURE_IMAGE_BYTES } from '@/domain/models/api/signatures/sign'
import { signingPagesOf } from '@/domain/models/app/signatures/signing-page-service'
import { requireAdminEditor, requireAdminTier } from '@/presentation/api/middleware/auth'
import { formBodyLimit } from '@/presentation/api/middleware/request-body-limit'
import { validationError } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { decodeJsonBody } from '@/presentation/api/runtime/request-body'
import {
  answerFailures,
  respondWith,
  runHandlerEffect,
} from '@/presentation/api/runtime/run-effect'
import {
  handleChallenge,
  signingCrossSiteGuard,
  signingLinkRoadLockout,
} from './challenge-handlers'
import { handleSigningDocument, SIGNING_DOCUMENT_PATH, signingPageGate } from './signing-page-gate'
import { handleDecline, handleSign } from './signing-session-handlers'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

const REQUEST_PATH = '/api/signatures/requests/:requestId'
const SIGN_PATH = '/api/signatures/sign'
const DECLINE_PATH = '/api/signatures/decline'
const CHALLENGE_PATH = '/api/signatures/challenge'
const EVIDENCE_PATH = '/api/signatures/requests/:requestId/evidence'
const EXPORT_PATH = '/api/signatures/requests/:requestId/export'
const ERASURES_PATH = '/api/signatures/requests/:requestId/erasures'

const requestIdOf = (c: Context): string => c.req.param('requestId') ?? ''

/** The largest signature post: the image at its cap, with room for the text fields and framing. */
const signBodyLimit = formBodyLimit(2 * MAX_SIGNATURE_IMAGE_BYTES)

function handleRequestStatus(c: Context, app: App): Promise<Response> {
  const read = readSignatureRequestStatus({
    ...{ app, requestId: requestIdOf(c) },
    session: getSessionContext(c),
  })
  return runHandlerEffect(c, respondWith(c, read, signatureRequestResponseSchema))
}

function handleEvidence(c: Context, app: App): Promise<Response> {
  return runHandlerEffect(
    c,
    respondWith(c, readSignatureEvidence(app, requestIdOf(c)), evidenceFileSchema)
  )
}

function handleExport(c: Context, app: App): Promise<Response> {
  return runHandlerEffect(
    c,
    respondWith(c, buildSignatureExport(app, requestIdOf(c)), exportManifestSchema)
  )
}

async function handleErasure(c: Context): Promise<Response> {
  const { decoded } = await decodeJsonBody(c, erasureRequestSchema)
  if (!decoded.success) {
    return validationError(c, [{ field: 'signer', message: 'Name the signer to erase' }])
  }
  const { signer } = decoded.data
  return runHandlerEffect(
    c,
    respondWith(
      c,
      eraseSignatureSigner({ requestId: requestIdOf(c), signer }).pipe(
        Effect.as({ erased: true as const, signer })
      ),
      erasureResponseSchema
    )
  )
}

/**
 * A signer's copy of a completed request: the PDF itself, never cached, never
 * handing its URL (which carries her token) to another site as a referrer.
 */
function handleDelivery(c: Context): Promise<Response> {
  const read = readDeliveredDocument({
    token: c.req.param('token') ?? '',
    file: c.req.param('file') ?? '',
  }).pipe(
    Effect.map(
      ({ bytes, file }) =>
        new Response(new Uint8Array(bytes), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${file}"`,
            'Cache-Control': 'no-store',
            'Referrer-Policy': 'no-referrer',
            'X-Content-Type-Options': 'nosniff',
          },
        })
    )
  )
  return runHandlerEffect(c, answerFailures(c, read))
}

/** Chain the evidence routes of signing requests onto a Hono app. */
export function chainSignatureRoutes(honoApp: Hono, app: App): void {
  // Each signing page a flow names is served through its gate only; an address
  // the link road is closed to never reaches the gate.
  signingPagesOf(app).forEach((page) =>
    honoApp.use(page.path, signingLinkRoadLockout(app, page.path), signingPageGate(app, page))
  )
  honoApp
    .get(REQUEST_PATH, (c) => handleRequestStatus(c, app))
    .get(SIGNING_DOCUMENT_PATH, (c) => handleSigningDocument(c, app))
    .use(SIGN_PATH, signingCrossSiteGuard)
    .use(DECLINE_PATH, signingCrossSiteGuard)
    .use(CHALLENGE_PATH, signingCrossSiteGuard)
    .post(CHALLENGE_PATH, (c) => handleChallenge(c, app))
    .use(SIGN_PATH, signBodyLimit)
    .post(SIGN_PATH, (c) => handleSign(c, app))
    .post(DECLINE_PATH, (c) => handleDecline(c, app))
    .get(DELIVERY_ROUTE_PATH, (c) => handleDelivery(c))
    .use(EVIDENCE_PATH, requireAdminTier(app))
    .use(EXPORT_PATH, requireAdminTier(app))
    .use(ERASURES_PATH, requireAdminEditor(app))
    .get(EVIDENCE_PATH, (c) => handleEvidence(c, app))
    .get(EXPORT_PATH, (c) => handleExport(c, app))
    .post(ERASURES_PATH, (c) => handleErasure(c))
}
