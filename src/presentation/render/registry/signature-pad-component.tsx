/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `signature-pad` SSR renderer — the well a signer signs in, or the reading of
 * a signature already given.
 *
 * Bound to a record (the page's, or a container's), the data-source pass hands
 * over the field's stored value, the record's id and its table. A signed field
 * is written once, so it draws only its reading — "Signed by … on …" with the
 * statement agreed to — and no well. An unsigned one mounts the pad island,
 * which uploads the mark and writes the signature through the records API, so
 * the server's write-once rule is the one that holds.
 */

import { SYSTEM_BUCKET_NAME } from '@/domain/models/app/buckets/bucket-identity'
import { cn } from '@/presentation/design/class-merge'
import type { ComponentRenderer } from './component-dispatch-config'
import type { Tables } from '@/domain/models/app/tables'
import type { ReactElement } from 'react'

interface PadRoot {
  readonly field?: string
  readonly statement?: string
  readonly height?: number
  readonly penWidth?: number
  readonly allowTyped?: boolean
}

interface StoredSignature {
  readonly signerName?: string
  readonly signedAt?: string
  readonly statement?: string
}

/** The stored signature, whether the driver hands it over parsed or as JSON text. */
function storedSignature(value: unknown): StoredSignature | undefined {
  const parsed = typeof value === 'string' && value.startsWith('{') ? safeParse(value) : value
  return typeof parsed === 'object' && parsed !== null ? (parsed as StoredSignature) : undefined
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

/** The day a signature was given, in the page's language. */
function signedOn(signedAt: string | undefined, lang: string | undefined): string {
  const instant = signedAt === undefined ? Number.NaN : Date.parse(signedAt)
  if (Number.isNaN(instant)) return 'an unknown date'
  return new Intl.DateTimeFormat(lang ?? 'en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(
    instant
  )
}

/** The reading of a signature already given. */
function signedReading(
  signature: StoredSignature,
  ctx: { readonly lang: string | undefined; readonly className: string | undefined }
): ReactElement {
  return (
    <figure
      data-component-type="signature-pad"
      data-signature-state="signed"
      className={cn('flex flex-col gap-1', ctx.className)}
    >
      <figcaption className="text-sm font-medium">
        {`Signed by ${signature.signerName ?? 'an unknown signer'} on ${signedOn(signature.signedAt, ctx.lang)}`}
      </figcaption>
      {signature.statement !== undefined && (
        <blockquote className="text-muted-foreground text-sm">{signature.statement}</blockquote>
      )}
    </figure>
  )
}

/** The bucket the field's signature images go to: its own, else the system bucket. */
function bucketOf(tables: Tables | undefined, table: unknown, field: string | undefined): string {
  const column = tables
    ?.find((candidate) => candidate.name === table)
    ?.fields.find((candidate) => candidate.name === field) as
    { readonly bucket?: string } | undefined
  return column?.bucket ?? SYSTEM_BUCKET_NAME
}

/** What the pad island needs to sign this record's field. */
function padIslandProps(ctx: {
  readonly root: PadRoot
  readonly rawProps: Record<string, unknown> | undefined
  readonly tables: Tables | undefined
  readonly signerName: string | undefined
  readonly label: unknown
  readonly lang: string | undefined
}): Readonly<Record<string, unknown>> {
  const { root, rawProps } = ctx
  const table = rawProps?.['_recordTable']
  return {
    table,
    recordId: rawProps?.['_recordId'],
    field: root.field,
    bucket: bucketOf(ctx.tables, table, root.field),
    statement: root.statement ?? '',
    signerName: ctx.signerName ?? '',
    height: root.height ?? 160,
    penWidth: root.penWidth ?? 2,
    allowTyped: root.allowTyped !== false,
    label: typeof ctx.label === 'string' ? ctx.label : 'Signature',
    lang: ctx.lang,
  }
}

export const signaturePadComponent: ComponentRenderer = ({
  component,
  rawProps,
  elementProps,
  tables,
  session,
  currentLang,
}) => {
  const root = (component ?? {}) as PadRoot
  const className = elementProps['className'] as string | undefined
  const signature = storedSignature(rawProps?.['_recordValue'])
  if (signature !== undefined) return signedReading(signature, { lang: currentLang, className })
  const islandProps = padIslandProps({
    root,
    rawProps,
    tables,
    signerName: session?.name,
    label: elementProps['aria-label'],
    lang: currentLang,
  })
  return (
    <div
      data-component-type="signature-pad"
      data-island="signature-pad"
      data-island-props={JSON.stringify(islandProps)}
      className={cn('flex flex-col gap-3', className)}
    >
      <p className="text-sm">{root.statement ?? ''}</p>
    </div>
  )
}
