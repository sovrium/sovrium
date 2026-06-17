/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { TEMP_STORAGE_PREFIX } from '@/domain/models/app/automations/actions/file/shared'
import {
  validateOutboundUrl,
  type OutboundUrlReason,
} from '@/infrastructure/utils/validate-outbound-url'



const MIME_BY_EXT: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  csv: 'text/csv',
  txt: 'text/plain',
  json: 'application/json',
  html: 'text/html',
  htm: 'text/html',
  xml: 'application/xml',
  yaml: 'application/yaml',
  yml: 'application/yaml',
}

export const mimeByExt = (key: string | undefined): string | undefined => {
  if (!key) return undefined
  const dot = key.lastIndexOf('.')
  if (dot === -1) return undefined
  return MIME_BY_EXT[key.slice(dot + 1).toLowerCase()]
}

export const extOf = (key: string | undefined): string => {
  if (!key) return ''
  const dot = key.lastIndexOf('.')
  if (dot === -1) return ''
  const segment = key.slice(dot)
  return /^\.[A-Za-z0-9]+$/.test(segment) ? segment : ''
}

export const tempKey = (suffix: string): string =>
  `${TEMP_STORAGE_PREFIX}${globalThis.crypto.randomUUID()}${suffix}`


export interface ResolvedSource {
  readonly bytes: Uint8Array
  readonly detectedMime?: string
}

export class OutboundUrlBlockedError extends Data.TaggedError('OutboundUrlBlockedError')<{
  readonly reason: OutboundUrlReason
}> {}

const parseDataUri = (source: string): ResolvedSource | undefined => {
  const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(source)
  if (!match) return undefined
  const [, mime, base64Flag, payload] = match
  const bytes = base64Flag
    ? new Uint8Array(Buffer.from(payload ?? '', 'base64'))
    : new TextEncoder().encode(decodeURIComponent(payload ?? ''))
  return mime ? { bytes, detectedMime: mime } : { bytes }
}

const fetchRemote = async (source: string): Promise<ResolvedSource> => {
  try {
    const response = await fetch(source)
    if (!response.ok) return { bytes: new Uint8Array(0) }
    const buf = await response.arrayBuffer()
    const headerMime = response.headers.get('content-type')?.split(';')[0]?.trim()
    return headerMime
      ? { bytes: new Uint8Array(buf), detectedMime: headerMime }
      : { bytes: new Uint8Array(buf) }
  } catch {
    return { bytes: new Uint8Array(0) }
  }
}

const fetchSource = (
  source: string
): Effect.Effect<ResolvedSource, OutboundUrlBlockedError, never> => {
  const validation = validateOutboundUrl(source)
  if (!validation.ok) {
    return Effect.fail(new OutboundUrlBlockedError({ reason: validation.issue.reason }))
  }
  return Effect.promise(() => fetchRemote(source))
}

export const resolveSource = (
  source: string
): Effect.Effect<ResolvedSource, OutboundUrlBlockedError, StorageService> => {
  const dataUri = parseDataUri(source)
  if (dataUri) return Effect.succeed(dataUri)
  if (/^https?:\/\//.test(source)) return fetchSource(source)
  return Effect.gen(function* () {
    const storage = yield* StorageService
    const downloaded = yield* Effect.either(storage.download(source))
    return downloaded._tag === 'Left' ? { bytes: new Uint8Array(0) } : { bytes: downloaded.right }
  })
}


export const csvCell = (value: unknown): string => {
  const str = value === undefined || value === null ? '' : String(value)
  return /[",\n;\t]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

interface SplitState {
  readonly cells: readonly string[]
  readonly current: string
  readonly inQuotes: boolean
  readonly skipNext: boolean
}

const stepSplit = (
  state: SplitState,
  ch: string,
  next: string | undefined,
  delim: string
): SplitState => {
  if (state.skipNext) return { ...state, skipNext: false }
  if (state.inQuotes) {
    if (ch === '"') {
      return next === '"'
        ? { ...state, current: state.current + '"', skipNext: true }
        : { ...state, inQuotes: false }
    }
    return { ...state, current: state.current + ch }
  }
  if (ch === '"') return { ...state, inQuotes: true }
  if (ch === delim) return { ...state, cells: [...state.cells, state.current], current: '' }
  return { ...state, current: state.current + ch }
}

export const splitCsvLine = (line: string, delimiter: string): readonly string[] => {
  const final = Array.from(line).reduce<SplitState>(
    (state, ch, i) => stepSplit(state, ch, line[i + 1], delimiter),
    { cells: [], current: '', inQuotes: false, skipNext: false }
  )
  return [...final.cells, final.current].map((c) => c.trim())
}

export const autoDelimiter = (sampleLine: string | undefined): string => {
  if (!sampleLine) return ','
  if (sampleLine.includes(',')) return ','
  if (sampleLine.includes('\t')) return '\t'
  if (sampleLine.includes(';')) return ';'
  if (sampleLine.includes('|')) return '|'
  return ','
}

export const splitNonEmptyLines = (text: string): readonly string[] =>
  text.split(/\r?\n/).filter((l) => l.trim() !== '')
