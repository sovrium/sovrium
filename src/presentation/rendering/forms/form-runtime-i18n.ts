/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { resolveText } from './form-field-resolver'
import type { FormOnError, FormOnSuccess } from '@/domain/models/app/forms'
import type { Languages } from '@/domain/models/app/languages'

export function resolveOnSuccessText(
  onSuccess: FormOnSuccess,
  languages: Languages | undefined,
  activeLang: string | undefined
): FormOnSuccess {
  if (languages === undefined) return onSuccess
  const record = onSuccess as Record<string, unknown>
  const { title, message, actions } = record
  return {
    ...record,
    ...(typeof title === 'string' ? { title: resolveText(title, languages, '', activeLang) } : {}),
    ...(typeof message === 'string'
      ? { message: resolveText(message, languages, '', activeLang) }
      : {}),
    ...(Array.isArray(actions)
      ? {
          actions: actions.map((action) => {
            const entry = action as Record<string, unknown>
            const { label } = entry
            return typeof label === 'string'
              ? { ...entry, label: resolveText(label, languages, '', activeLang) }
              : entry
          }),
        }
      : {}),
  } as unknown as FormOnSuccess
}

export function resolveOnErrorText(
  onError: FormOnError,
  languages: Languages | undefined,
  activeLang: string | undefined
): FormOnError {
  if (languages === undefined) return onError
  const record = onError as Record<string, unknown>
  const { message } = record
  return {
    ...record,
    ...(typeof message === 'string'
      ? { message: resolveText(message, languages, '', activeLang) }
      : {}),
  } as unknown as FormOnError
}
