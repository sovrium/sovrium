/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { FormSubmissionRepository } from '@/application/ports/repositories/form-submission-repository'
import { ShareLinkRepository } from '@/application/ports/repositories/share-link-repository'
import { buildGuestSession } from '@/application/use-cases/automations/build-guest-session'
import { createRecordProgram } from '@/application/use-cases/tables/programs'
import {
  generateShareToken,
  hashSharePassword,
  resolveExpiryTimestamp,
  verifySharePassword,
} from '@/domain/utils/share-link-helpers'
import {
  SHARE_LINK_RATE_LIMIT_MAX_PER_WINDOW,
  SHARE_LINK_RATE_LIMIT_WINDOW_SECONDS,
} from '@/domain/utils/timeouts'
import { requireSession, unauthorized } from '@/presentation/api/utils/auth-helpers'
import { provideShareLinkLive } from './effect-runner'
import type { ShareLinkRow } from '@/application/ports/repositories/share-link-repository'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * Share-link API routes.
 *
 * Admin (auth-required) routes:
 *   POST   /api/pages/:name/share              → create
 *   GET    /api/pages/:name/share              → list for page
 *   PATCH  /api/pages/:name/share/:token       → update
 *   DELETE /api/pages/:name/share/:token       → revoke
 *
 * Public (no-auth) routes:
 *   GET    /shared/:token                      → resolve (returns metadata
 *                                                + status; full HTML render
 *                                                deferred to plan 05b)
 *   POST   /shared/:token/auth                 → submit password, returns
 *                                                whether the link is now
 *                                                accessible
 *
 * Public routes never expose passwordHash; they record analytics
 * (view_count, last_accessed_at) only on successful resolves — failed
 * password attempts and expired/revoked lookups do not increment.
 *
 * The /shared/:token PUBLIC RESOLVE returns JSON metadata for now.
 * Hooking into the page-render pipeline so the response is the
 * actual rendered HTML lives in plan 05b — out of scope here.
 */

/**
 * Public-facing shape of a share link. Strips passwordHash and
 * created_by_id; adds a `passwordProtected` boolean to indicate the
 * presence of a password without exposing its hash.
 */
const shapeLink = (row: ShareLinkRow) => ({
  id: row.id,
  pageName: row.pageName,
  token: row.token,
  passwordProtected: row.passwordHash !== undefined,
  expiresAt: row.expiresAt?.toISOString() ?? undefined,
  embedAllowed: row.embedAllowed,
  createdAt: row.createdAt.toISOString(),
  revokedAt: row.revokedAt?.toISOString() ?? undefined,
  viewCount: row.viewCount,
  lastAccessedAt: row.lastAccessedAt?.toISOString() ?? undefined,
})

interface CreateBody {
  readonly password?: string
  readonly expiresIn?: string
  readonly embedAllowed?: boolean
}

async function handleCreateShareLink(c: Context) {
  const session = requireSession(c)
  if (session === undefined) return unauthorized(c)
  const pageName = c.req.param('name')
  if (pageName === undefined) {
    return c.json({ success: false, message: 'Page name required', code: 'BAD_REQUEST' }, 400)
  }
  const body = ((await c.req.json().catch(() => undefined)) ?? {}) as CreateBody

  const passwordHash =
    typeof body.password === 'string' && body.password !== ''
      ? await hashSharePassword(body.password)
      : undefined
  const expiresAt = resolveExpiryTimestamp(body.expiresIn)

  const program = Effect.gen(function* () {
    const repo = yield* ShareLinkRepository
    const token = generateShareToken()
    return yield* repo.create({
      pageName,
      token,
      ...(passwordHash !== undefined ? { passwordHash } : {}),
      ...(expiresAt !== undefined ? { expiresAt } : {}),
      ...(body.embedAllowed !== undefined ? { embedAllowed: body.embedAllowed } : {}),
      createdById: session.userId,
    })
  })

  const result = await Effect.runPromise(provideShareLinkLive(program).pipe(Effect.either))
  if (result._tag === 'Left') {
    return c.json(
      { success: false, message: 'Failed to create share link', code: 'INTERNAL_ERROR' },
      500
    )
  }
  return c.json(shapeLink(result.right), 201)
}

async function handleListShareLinks(c: Context) {
  const session = requireSession(c)
  if (session === undefined) return unauthorized(c)
  const pageName = c.req.param('name')
  if (pageName === undefined) {
    return c.json({ success: false, message: 'Page name required', code: 'BAD_REQUEST' }, 400)
  }

  const program = Effect.gen(function* () {
    const repo = yield* ShareLinkRepository
    return yield* repo.listForPage(pageName)
  })
  const result = await Effect.runPromise(provideShareLinkLive(program).pipe(Effect.either))
  if (result._tag === 'Left') {
    return c.json(
      { success: false, message: 'Failed to list share links', code: 'INTERNAL_ERROR' },
      500
    )
  }
  return c.json({ links: result.right.map(shapeLink) }, 200)
}

/* eslint-disable unicorn/no-null -- explicit null is the API contract for "clear this column"; undefined means "skip" */
interface UpdateBody {
  readonly password?: string | null
  readonly expiresIn?: string | null
  readonly embedAllowed?: boolean
}

const resolvePasswordPatch = async (
  raw: string | null | undefined
): Promise<string | null | undefined> => {
  if (raw === null) return null
  if (typeof raw === 'string' && raw !== '') return await hashSharePassword(raw)
  return undefined
}

const resolveExpiryPatch = (raw: string | null | undefined): Date | null | undefined => {
  if (raw === null) return null
  return resolveExpiryTimestamp(raw ?? undefined)
}
/* eslint-enable unicorn/no-null */

async function handleUpdateShareLink(c: Context) {
  const session = requireSession(c)
  if (session === undefined) return unauthorized(c)
  const token = c.req.param('token')
  if (token === undefined) {
    return c.json({ success: false, message: 'Token required', code: 'BAD_REQUEST' }, 400)
  }
  const body = ((await c.req.json().catch(() => undefined)) ?? {}) as UpdateBody

  const passwordHash = await resolvePasswordPatch(body.password)
  const expiresAt = resolveExpiryPatch(body.expiresIn)

  const program = Effect.gen(function* () {
    const repo = yield* ShareLinkRepository
    return yield* repo.update({
      token,
      ...(passwordHash !== undefined ? { passwordHash } : {}),
      ...(expiresAt !== undefined ? { expiresAt } : {}),
      ...(body.embedAllowed !== undefined ? { embedAllowed: body.embedAllowed } : {}),
    })
  })
  const result = await Effect.runPromise(provideShareLinkLive(program).pipe(Effect.either))
  if (result._tag === 'Left') {
    return c.json(
      { success: false, message: 'Failed to update share link', code: 'INTERNAL_ERROR' },
      500
    )
  }
  if (result.right === undefined) {
    return c.json({ success: false, message: 'Share link not found', code: 'NOT_FOUND' }, 404)
  }
  return c.json(shapeLink(result.right), 200)
}

async function handleRevokeShareLink(c: Context) {
  const session = requireSession(c)
  if (session === undefined) return unauthorized(c)
  const token = c.req.param('token')
  if (token === undefined) {
    return c.json({ success: false, message: 'Token required', code: 'BAD_REQUEST' }, 400)
  }
  const program = Effect.gen(function* () {
    const repo = yield* ShareLinkRepository
    return yield* repo.revoke(token)
  })
  const result = await Effect.runPromise(provideShareLinkLive(program).pipe(Effect.either))
  if (result._tag === 'Left') {
    return c.json(
      { success: false, message: 'Failed to revoke share link', code: 'INTERNAL_ERROR' },
      500
    )
  }
  return c.json({ success: true, revoked: result.right }, 200)
}

async function handlePublicResolve(c: Context) {
  const token = c.req.param('token')
  if (token === undefined) return c.json({ error: 'token_required' }, 400)
  const passwordHeader = c.req.header('x-share-password') ?? ''

  const program = Effect.gen(function* () {
    const repo = yield* ShareLinkRepository
    const link = yield* repo.findActiveByToken(token)
    if (link === undefined) {
      return { kind: 'not-found' as const }
    }
    const { passwordHash } = link
    if (passwordHash !== undefined) {
      const ok =
        passwordHeader !== ''
          ? yield* Effect.promise(() => verifySharePassword(passwordHeader, passwordHash))
          : false
      if (!ok) return { kind: 'password-required' as const, link }
    }
    yield* repo.recordAccess(token)
    return { kind: 'ok' as const, link }
  })

  const result = await Effect.runPromise(provideShareLinkLive(program).pipe(Effect.either))
  if (result._tag === 'Left') {
    return c.json({ error: 'resolve_failed' }, 500)
  }
  if (result.right.kind === 'not-found') {
    return c.json({ error: 'not_found_or_revoked_or_expired' }, 404)
  }
  if (result.right.kind === 'password-required') {
    return c.json(
      {
        error: 'password_required',
        passwordProtected: true,
        embedAllowed: result.right.link.embedAllowed,
      },
      401
    )
  }
  return c.json(
    {
      pageName: result.right.link.pageName,
      embedAllowed: result.right.link.embedAllowed,
      passwordProtected: false,
    },
    200
  )
}

interface AuthBody {
  readonly password?: string
}

async function handlePublicAuth(c: Context) {
  const token = c.req.param('token')
  if (token === undefined) return c.json({ error: 'token_required' }, 400)
  const body = ((await c.req.json().catch(() => undefined)) ?? {}) as AuthBody
  const submittedPassword = body.password
  if (typeof submittedPassword !== 'string' || submittedPassword === '') {
    return c.json({ error: 'password_required' }, 400)
  }

  const program = Effect.gen(function* () {
    const repo = yield* ShareLinkRepository
    const link = yield* repo.findActiveByToken(token)
    if (link === undefined) return { kind: 'not-found' as const }
    const { passwordHash } = link
    if (passwordHash === undefined) return { kind: 'no-password' as const }
    const ok = yield* Effect.promise(() => verifySharePassword(submittedPassword, passwordHash))
    if (!ok) return { kind: 'wrong-password' as const }
    yield* repo.recordAccess(token)
    return { kind: 'ok' as const }
  })

  const result = await Effect.runPromise(provideShareLinkLive(program).pipe(Effect.either))
  if (result._tag === 'Left') return c.json({ error: 'auth_failed' }, 500)
  if (result.right.kind === 'not-found') return c.json({ error: 'not_found' }, 404)
  if (result.right.kind === 'wrong-password') return c.json({ error: 'wrong_password' }, 401)
  return c.json({ success: true }, 200)
}

// ─── Public form submission ────────────────────────────────────────────────

interface DataFormProps {
  readonly table?: string
  readonly fields?: readonly string[]
}

interface PageComponent {
  readonly type?: string
  readonly props?: DataFormProps
}

interface SharedPage {
  readonly name: string
  readonly sharing?: { readonly enabled?: boolean; readonly formSubmissions?: boolean }
  readonly components?: readonly PageComponent[]
}

const findDataFormComponent = (page: SharedPage): DataFormProps | undefined => {
  const found = page.components?.find((c) => c.type === 'data-form')
  return found?.props
}

const filterAllowedFields = (
  data: Record<string, unknown>,
  allowed: readonly string[] | undefined
): Record<string, unknown> => {
  if (allowed === undefined || allowed.length === 0) return data
  return Object.fromEntries(Object.entries(data).filter(([key]) => allowed.includes(key)))
}

const extractClientIp = (c: Context): string => {
  const forwarded = c.req.header('x-forwarded-for')
  if (typeof forwarded === 'string' && forwarded !== '') {
    return forwarded.split(',')[0]?.trim() ?? 'unknown'
  }
  return c.req.header('x-real-ip') ?? 'unknown'
}

interface SubmitContext {
  readonly link: ShareLinkRow
  readonly page: SharedPage
  readonly form: DataFormProps
}

const resolveSubmitContext = (
  c: Context,
  app: App,
  link: ShareLinkRow
): SubmitContext | { readonly response: Response } => {
  const pages = (app as { pages?: readonly SharedPage[] }).pages ?? []
  const page = pages.find((p) => p.name === link.pageName)
  if (page === undefined) {
    return { response: c.json({ error: 'page_not_found' }, 404) }
  }
  if (page.sharing?.formSubmissions !== true) {
    return { response: c.json({ error: 'form_submissions_disabled' }, 403) }
  }
  const form = findDataFormComponent(page)
  if (form === undefined || typeof form.table !== 'string' || form.table === '') {
    return { response: c.json({ error: 'no_data_form_component' }, 422) }
  }
  return { link, page, form }
}

type ResolveResult =
  | { readonly kind: 'not-found' }
  | { readonly kind: 'rate-limited' }
  | { readonly kind: 'ready'; readonly link: ShareLinkRow }

const resolveLinkAndRateLimit = (
  token: string,
  ipAddress: string
): Effect.Effect<ResolveResult, never, ShareLinkRepository | FormSubmissionRepository> =>
  Effect.gen(function* () {
    const shareRepo = yield* ShareLinkRepository
    const linkResult = yield* Effect.either(shareRepo.findActiveByToken(token))
    if (linkResult._tag === 'Left' || linkResult.right === undefined) {
      return { kind: 'not-found' as const }
    }
    const formRepo = yield* FormSubmissionRepository
    const countResult = yield* Effect.either(
      formRepo.countRecentByIp({
        ipAddress,
        windowSeconds: SHARE_LINK_RATE_LIMIT_WINDOW_SECONDS,
      })
    )
    if (countResult._tag === 'Right' && countResult.right >= SHARE_LINK_RATE_LIMIT_MAX_PER_WINDOW) {
      return { kind: 'rate-limited' as const }
    }
    return { kind: 'ready' as const, link: linkResult.right }
  })

async function handlePublicSubmit(c: Context, app: App) {
  const token = c.req.param('token')
  if (token === undefined) return c.json({ error: 'token_required' }, 400)
  const body = ((await c.req.json().catch(() => undefined)) ?? {}) as Record<string, unknown>
  const ipAddress = extractClientIp(c)

  const phase1 = await Effect.runPromise(
    provideShareLinkLive(resolveLinkAndRateLimit(token, ipAddress)).pipe(Effect.either)
  )
  if (phase1._tag === 'Left') return c.json({ error: 'submit_failed' }, 500)
  if (phase1.right.kind === 'not-found') return c.json({ error: 'not_found' }, 404)
  if (phase1.right.kind === 'rate-limited') return c.json({ error: 'rate_limited' }, 429)

  const ctx = resolveSubmitContext(c, app, phase1.right.link)
  if ('response' in ctx) return ctx.response

  const fields = filterAllowedFields(body, ctx.form.fields)

  // Phase 2: write the audit row + the table record. Both phases
  // surface as 422 on failure so validation errors from the table
  // layer (e.g. invalid email format) bubble up cleanly. Audit insert
  // and record insert race minimally — if the audit write succeeds and
  // the record insert fails, we leak one orphan audit row, which is
  // acceptable for the volume profile.
  const writeProgram = Effect.gen(function* () {
    const formRepo = yield* FormSubmissionRepository
    yield* formRepo.create({
      pageName: ctx.link.pageName,
      shareToken: token,
      tableName: ctx.form.table!,
      submittedData: body,
      ipAddress,
    })
    return yield* createRecordProgram({
      session: buildGuestSession(),
      tableName: ctx.form.table!,
      fields,
    })
  })

  const phase2 = await Effect.runPromise(provideShareLinkLive(writeProgram).pipe(Effect.either))
  if (phase2._tag === 'Left') {
    // Validation errors from the table layer (e.g., bad email format)
    // surface here. Map to 422; infrastructure errors are
    // indistinguishable here without inspecting the cause, so we lean
    // on 422 as the conservative client-error code for any failure
    // that bubbled up from the record-create program.
    return c.json({ error: 'submission_invalid' }, 422)
  }
  return c.json({ success: true, id: phase2.right.id }, 201)
}

/* eslint-disable drizzle/enforce-delete-with-where -- the .delete() below is a Hono route definition, not a Drizzle delete */
export function chainShareLinkRoutes<T extends Hono>(honoApp: T, app: App): T {
  return honoApp
    .post('/api/pages/:name/share', handleCreateShareLink)
    .get('/api/pages/:name/share', handleListShareLinks)
    .patch('/api/pages/:name/share/:token', handleUpdateShareLink)
    .delete('/api/pages/:name/share/:token', handleRevokeShareLink)
    .get('/shared/:token', handlePublicResolve)
    .post('/shared/:token/auth', handlePublicAuth)
    .post('/shared/:token/submit', (c) => handlePublicSubmit(c, app)) as T
}
/* eslint-enable drizzle/enforce-delete-with-where */
