/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { extractText, getDocumentProxy } from 'unpdf'
import { markdownToText } from '@/domain/services/markdown-to-text'

export const SUPPORTED_DOCUMENT_EXTENSIONS: ReadonlySet<string> = new Set(['.pdf', '.md', '.txt'])

export const fileExtension = (path: string): string => {
  const base = path.slice(path.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  return dot <= 0 ? '' : base.slice(dot).toLowerCase()
}

export const isSupportedDocument = (path: string): boolean =>
  SUPPORTED_DOCUMENT_EXTENSIONS.has(fileExtension(path))

const parsePdf = async (bytes: Uint8Array): Promise<string> => {
  const fallback = new TextDecoder('utf-8').decode(bytes)
  try {
    const pdf = await getDocumentProxy(Uint8Array.from(bytes))
    const { text } = await extractText(pdf, { mergePages: true })
    const merged = Array.isArray(text) ? text.join('\n') : text
    if (merged.trim().length > 0) return merged
  } catch {
  }
  return fallback
}

export const parseDocument = async (input: {
  readonly path: string
  readonly bytes: Uint8Array
}): Promise<string> => {
  const ext = fileExtension(input.path)
  if (ext === '.pdf') {
    return parsePdf(input.bytes)
  }
  const text = new TextDecoder('utf-8').decode(input.bytes)
  if (ext === '.md') {
    return markdownToText(text)
  }
  return text
}
