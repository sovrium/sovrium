/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { DataSourceRepository } from '@/application/ports/repositories/data-source-repository'
import { findMatchingRoute } from '@/domain/utils/route-matcher'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

export type InlinePrefillRevalidationResult =
  | { readonly kind: 'not-applicable' }
  | { readonly kind: 'parent-found'; readonly record: Readonly<Record<string, unknown>> }
  | {
      readonly kind: 'parent-missing'
      readonly tableName: string
      readonly paramField: string
      readonly paramValue: string
    }

const extractRefererPathname = (referer: string | undefined): string | undefined => {
  if (typeof referer !== 'string' || referer === '') return undefined
  if (referer.startsWith('/')) return referer.split('?')[0]
  try {
    return new URL(referer).pathname
  } catch {
    return undefined
  }
}

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

type RevalidationLookup =
  | { readonly kind: 'not-applicable' }
  | {
      readonly kind: 'lookup'
      readonly tableName: string
      readonly paramField: string
      readonly paramValue: string
    }

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
