/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isCanonicalStorageKey } from '@/domain/kernel/identity/storage-key'
import { isSignatureNamespaceKey } from '@/domain/models/app/signatures/signature-capture-service'

/**
 * Why a document step may not write at the key it authored, or `undefined`:
 * the key must be a plain relative key, and never one under the signature
 * namespace (a request's evidence or a signature mark), which only the
 * signing path writes (its signed
 * document and proof file sit in the bucket of the record fields they fill,
 * so a step attaching to that field would otherwise reach them).
 */
export const authoredKeyRefusal = (key: string): string | undefined => {
  if (!isCanonicalStorageKey(key))
    return `output key "${key}" must be a relative key with no "." or ".." segment`
  return isSignatureNamespaceKey(key)
    ? `output key "${key}" is signing evidence, which only a signing flow writes`
    : undefined
}
