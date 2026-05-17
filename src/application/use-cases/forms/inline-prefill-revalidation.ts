/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Inline-prefill submission revalidation (Y-5).
 *
 * When a host page with `dataSource: { mode: 'single' }` embeds a form via
 * `{ type: 'form', formRef: <name>, inlinePrefill: { lockPrefill: true } }`,
 * the rendered form carries `<input type="hidden">` entries seeded from
 * the host record's `$parent.<field>` references. The submitter cannot
 * edit these values, but a deletion of the parent record between page-load
 * and form-submit would leave the new child record dangling against a
 * non-existent parent. To close that race window, the form route invokes
 * this revalidator on every locked-prefill submission and rejects with
 * 422 when the parent is gone.
 *
 * The detection logic is purely declarative: we walk `app.pages[]`,
 * locate the page whose `path` matches the submission's `Referer` URL,
 * and check whether it embeds the requested form with
 * `inlinePrefill.lockPrefill: true`. If yes, we attempt to fetch the
 * parent record using the page's `dataSource.param`. The form route
 * decides what to do with the result — either proceed with submission
 * (parent OK / no inline-create context) or surface a 422.
 */

import { Effect } from 'effect'
import { DataSourceRepository } from '@/application/ports/repositories/data-source-repository'
import { findMatchingRoute } from '@/domain/utils/route-matcher'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Outcome of an inline-prefill revalidation pass.
 *
 * - `not-applicable` — the submission has no Referer, the Referer doesn't
 *   match any page, the matched page has no single-mode dataSource, or no
 *   form-ref on the page targets this form name with `lockPrefill: true`.
 *   The form route should proceed with submission as usual.
 * - `parent-found` — the host page's parent record exists. Submission is
 *   safe.
 * - `parent-missing` — the host page's parent record was deleted between
 *   page-render and form-submit. The form route should respond with 422
 *   so the submitter sees an explicit "parent does not exist" error
 *   instead of silently linking to a dangling row.
 * @public
 */
export type InlinePrefillRevalidationResult =
  | { readonly kind: 'not-applicable' }
  | { readonly kind: 'parent-found'; readonly record: Readonly<Record<string, unknown>> }
  | {
      readonly kind: 'parent-missing'
      readonly tableName: string
      readonly paramField: string
      readonly paramValue: string
    }

/**
 * Resolve the pathname segment of a Referer header value. Handles both
 * absolute URLs (`https://example.com/projects/1`) and bare paths
 * (`/projects/1`) since reverse proxies sometimes rewrite Referer.
 *
 * Returns `undefined` when the value is missing or unparseable so the
 * caller short-circuits to `not-applicable` rather than crashing on
 * malformed headers.
 */
const extractRefererPathname = (referer: string | undefined): string | undefined => {
  if (typeof referer !== 'string' || referer === '') return undefined
  if (referer.startsWith('/')) return referer.split('?')[0]
  try {
    return new URL(referer).pathname
  } catch {
    return undefined
  }
}

/**
 * Read the page-level `dataSource` declaration off a `Page` value. Returns
 * `undefined` when the page has no dataSource OR when the mode is not
 * `single` (only single-mode pages expose a `$parent` record that can be
 * revalidated).
 */
const extractSingleModeDataSource = (
  page: Page
): { readonly table: string; readonly param: string } | undefined => {
  const { dataSource } = page as {
    readonly dataSource?: {
      readonly table: string
      readonly mode?: string
      readonly param?: string
    }
  }
  if (dataSource === undefined) return undefined
  if (dataSource.mode !== 'single') return undefined
  return { table: dataSource.table, param: dataSource.param ?? dataSource.table }
}

/**
 * Walk a page's components looking for a `{ type: 'form', formRef: <name>,
 * inlinePrefill: { lockPrefill: true } }` declaration that targets the
 * requested form name. Returns true on the first match.
 *
 * `inlinePrefill` without `lockPrefill: true` does NOT trigger
 * revalidation: in that mode the submitter sees the prefilled value as
 * an editable default, so a stale parent simply means the user picked a
 * value that no longer resolves — the table layer can fail with its
 * normal foreign-key / validation error instead of a synthetic 422.
 */
const pageEmbedsLockedFormRef = (page: Page, formName: string): boolean => {
  if (!page.components) return false
  return page.components.some((item) => {
    if ('component' in item || '$ref' in item) return false
    const component = item as Component
    if (component.type !== 'form') return false
    const { formRef: ref } = component as { readonly formRef?: unknown }
    if (ref !== formName) return false
    const { inlinePrefill } = component as {
      readonly inlinePrefill?: { readonly lockPrefill?: boolean }
    }
    return inlinePrefill?.lockPrefill === true
  })
}

interface RevalidationContext {
  readonly app: Readonly<App>
  readonly formName: string
  readonly referer?: string
}

/**
 * Per-submission lookup result distilled from `app.pages[]` + Referer.
 *
 * Either the inline-create wiring is incomplete (`not-applicable`) or we
 * have a concrete `(table, paramField, paramValue)` triple to revalidate.
 * Splitting this resolution out of the Effect generator keeps the
 * cyclomatic complexity inside the generator below the lint cap and lets
 * the per-page checks remain pure / synchronous.
 */
type RevalidationLookup =
  | { readonly kind: 'not-applicable' }
  | {
      readonly kind: 'lookup'
      readonly tableName: string
      readonly paramField: string
      readonly paramValue: string
    }

/**
 * Resolve the host page for the submission's Referer URL and verify it
 * declares the inline-create wiring this revalidator targets. Returns the
 * concrete `(table, paramField, paramValue)` triple to fetch when all
 * preconditions are met, otherwise short-circuits to `not-applicable`.
 *
 * Pure (no Effect / I/O) so the generator stays focused on the
 * `DataSourceRepository.fetchSingleRecord` call.
 */
const resolveRevalidationLookup = (ctx: RevalidationContext): RevalidationLookup => {
  const pathname = extractRefererPathname(ctx.referer)
  if (pathname === undefined) return { kind: 'not-applicable' }

  const pages = ctx.app.pages ?? []
  if (pages.length === 0) return { kind: 'not-applicable' }

  const match = findMatchingRoute(
    pages.map((page) => page.path),
    pathname
  )
  if (match === undefined) return { kind: 'not-applicable' }

  const page = pages[match.index]
  if (page === undefined) return { kind: 'not-applicable' }
  if (!pageEmbedsLockedFormRef(page, ctx.formName)) return { kind: 'not-applicable' }

  const dataSource = extractSingleModeDataSource(page)
  if (dataSource === undefined) return { kind: 'not-applicable' }

  const paramValue = match.params[dataSource.param]
  if (paramValue === undefined || paramValue === '') return { kind: 'not-applicable' }

  return {
    kind: 'lookup',
    tableName: dataSource.table,
    paramField: dataSource.param,
    paramValue,
  }
}

/**
 * Run the inline-prefill revalidation pass for a form submission.
 *
 * Returns `not-applicable` for submissions that did not originate from an
 * inline-create context; the form route should treat those as ordinary
 * submissions. Returns `parent-found` / `parent-missing` for submissions
 * whose host page declares a single-mode dataSource AND embeds the
 * submitted form with `lockPrefill: true`.
 *
 * The use case requires `DataSourceRepository` so it can issue the
 * single-record fetch through the same infrastructure layer that powers
 * page-level dataSource resolution. Wiring this in via
 * `DataSourceRepositoryLive` keeps the revalidation read-path consistent
 * with what the page renderer used at embed time — same table, same
 * `paramField`, same `paramValue` plumbing.
 */
export const revalidateInlinePrefillParent = (ctx: RevalidationContext) =>
  Effect.gen(function* () {
    const lookup = resolveRevalidationLookup(ctx)
    if (lookup.kind === 'not-applicable') return { kind: 'not-applicable' as const }

    const repo = yield* DataSourceRepository
    const record = yield* repo.fetchSingleRecord(
      lookup.tableName,
      lookup.paramField,
      lookup.paramValue
    )
    if (record === undefined) {
      return {
        kind: 'parent-missing' as const,
        tableName: lookup.tableName,
        paramField: lookup.paramField,
        paramValue: lookup.paramValue,
      }
    }
    return { kind: 'parent-found' as const, record }
  })
