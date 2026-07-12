/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { renderToast } from '../data-table/island/toast'
import { applyFetchSuccessEffects } from '../shared/action-executor'
import type {
  FetchSuccessResponse,
  FetchToastResponse,
} from '@/domain/models/app/pages/components/action'

export interface UploadSubmitConfig {
  readonly url: string
  readonly onSuccess?: FetchSuccessResponse
  readonly onError?: FetchToastResponse
}

function renderUploadError(onError: FetchToastResponse | undefined): void {
  if (onError) renderToast(onError.message, onError.variant)
}

export async function submitUpload(
  files: readonly File[],
  config: UploadSubmitConfig
): Promise<boolean> {
  const body = new FormData()
  files.forEach((file) => body.append('file', file))
  try {
    const res = await fetch(config.url, { method: 'POST', body, credentials: 'include' })
    if (res.ok) {
      applyFetchSuccessEffects(config.onSuccess)
      return true
    }
    renderUploadError(config.onError)
    return false
  } catch {
    renderUploadError(config.onError)
    return false
  }
}
