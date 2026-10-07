/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `file-preview` pass: turn what a preview NAMES into the files it draws,
 * each behind an address signed for this caller.
 *
 * Runs last, once the page's record binding has handed each field-bound
 * preview its raw attachment value (`_recordValue`, `_recordTable`), so it
 * sees exactly what the record read admitted. It attaches `_previewFiles` —
 * `{ name, type, url }` per file — and nothing else; the renderer draws from
 * that and never sees a storage key without its signature.
 *
 * A preview whose file cannot be signed (no signer on this render, a bucket
 * that refuses the caller, an attachment with no key) carries no file at all,
 * so the page shows neither the file nor its address.
 */

import { inferMimeFromKey } from '@/domain/kernel/identity/mime-types'
import type { DataSourceDb } from './data-source-contracts'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/** One file a preview draws. */
export interface PreviewFile {
  readonly name: string
  readonly type: string
  readonly url: string
}

interface PreviewRoot {
  readonly field?: string
  readonly file?: { readonly bucket: string; readonly key: string }
  readonly props?: Record<string, unknown>
}

interface StoredAttachment {
  readonly key: string
  readonly name: string
  readonly type?: string
}

const baseName = (key: string): string => key.split('/').filter(Boolean).at(-1) ?? key

/** A JSON-encoded attachment, or a bare storage key, as the object it names. */
function parseStoredString(value: string): unknown {
  if (!value.trim().startsWith('{')) return value === '' ? undefined : { key: value }
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

const firstString = (...candidates: readonly unknown[]): string | undefined =>
  candidates.find((candidate): candidate is string => typeof candidate === 'string')

/** One stored attachment value — an object, a bare key, or a JSON string of either. */
function attachmentOf(value: unknown): StoredAttachment | undefined {
  const raw = typeof value === 'string' ? parseStoredString(value) : value
  if (typeof raw !== 'object' || raw === null) return undefined
  const record = raw as Record<string, unknown>
  const key = firstString(record['key'])
  if (key === undefined) return undefined
  const type = firstString(record['type'], record['mimeType'])
  return {
    key,
    name: firstString(record['name'], record['filename']) ?? baseName(key),
    ...(type !== undefined && { type }),
  }
}

/** Every attachment a field value holds, in order. */
const attachmentsOf = (value: unknown): readonly StoredAttachment[] =>
  (Array.isArray(value) ? value : [value]).flatMap((entry) => {
    const attachment = attachmentOf(entry)
    return attachment === undefined ? [] : [attachment]
  })

/** The bucket a record's attachment column declares, read off the app's tables. */
function columnBucket(app: App, table: unknown, field: string | undefined): string | undefined {
  const column = app.tables
    ?.find((candidate) => candidate.name === table)
    ?.fields.find((candidate) => candidate.name === field) as
    { readonly bucket?: string } | undefined
  return column?.bucket
}

/** The files one preview names, each signed for the caller, or none. */
async function previewFilesOf(
  root: PreviewRoot,
  ctx: { readonly app: App; readonly db: DataSourceDb }
): Promise<readonly PreviewFile[]> {
  const sign = ctx.db.signFileUrl
  if (sign === undefined) return []
  if (root.file !== undefined) {
    const url = await sign(root.file.bucket, root.file.key, 'bucket')
    const name = baseName(root.file.key)
    return url === undefined ? [] : [{ name, type: inferMimeFromKey(root.file.key), url }]
  }
  const bucket = columnBucket(ctx.app, root.props?.['_recordTable'], root.field)
  if (bucket === undefined) return []
  const signed = await Promise.all(
    attachmentsOf(root.props?.['_recordValue']).map(async (attachment) => {
      const url = await sign(bucket, attachment.key, 'record')
      return url === undefined
        ? undefined
        : { name: attachment.name, type: attachment.type ?? inferMimeFromKey(attachment.key), url }
    })
  )
  return signed.filter((file): file is PreviewFile => file !== undefined)
}

async function resolveNode(
  node: Component | string,
  ctx: { readonly app: App; readonly db: DataSourceDb }
): Promise<Component | string> {
  if (typeof node === 'string') return node
  const children = node.children as readonly (Component | string)[] | undefined
  const resolvedChildren =
    children === undefined ? undefined : await Promise.all(children.map((c) => resolveNode(c, ctx)))
  const withChildren =
    resolvedChildren === undefined ? node : ({ ...node, children: resolvedChildren } as Component)
  if (node.type !== 'file-preview') return withChildren
  const files = await previewFilesOf(node as PreviewRoot, ctx)
  return { ...withChildren, props: { ...node.props, _previewFiles: files } } as Component
}

/** Attach the signed files of every `file-preview` on the page. */
export async function resolveFilePreviews(
  page: Page,
  ctx: { readonly app: App; readonly db: DataSourceDb }
): Promise<Page> {
  if (!page.components || page.components.length === 0) return page
  const components = await Promise.all(page.components.map((c) => resolveNode(c, ctx)))
  return { ...page, components: components as Page['components'] }
}
