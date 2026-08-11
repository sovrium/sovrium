/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Server-side `$t:` resolution for the form runtime config.
 *
 * `buildFormRuntimeConfig` serializes `onSuccess` / `onError` into the SSR
 * `data-form-config` block that the client runtime reads. Any `$t:` token must
 * be resolved to the active locale BEFORE serialization (the client runtime has
 * no translation catalog), so an embedded form's success/error strings match
 * the host page's locale. Sliced out of `form-runtime.tsx` so that file stays
 * under the project's max-lines cap.
 */

import { resolveText } from './form-field-resolver'
import type { FormOnError, FormOnSuccess } from '@/domain/models/app/forms'
import type { Languages } from '@/domain/models/app/languages'

/**
 * Resolve any `$t:` tokens inside an `onSuccess` payload against the active
 * locale. The user-facing string surfaces are resolved (`title` / `message`,
 * the redirect / navigate `url`, and each `actions[].label` / `actions[].url`);
 * every other field is copied through verbatim. Returns the payload unchanged
 * when the app has no `languages` block so a monolingual form pays no cost.
 *
 * The `url` surfaces let a per-locale form redirect to a
 * locale-specific path — the `$t:` key is resolved here, server-side, BEFORE
 * the runtime config is serialized (the client runtime has no catalog). The
 * submit-time template variables (`$submission.id` / `$record.*`) are
 * interpolated LATER, client-side, against the submission response.
 */
export function resolveOnSuccessText(
  onSuccess: FormOnSuccess,
  languages: Languages | undefined,
  activeLang: string | undefined
): FormOnSuccess {
  if (languages === undefined) return onSuccess
  const record = onSuccess as Record<string, unknown>
  const { title, message, url, actions } = record
  return {
    ...record,
    ...(typeof title === 'string' ? { title: resolveText(title, languages, '', activeLang) } : {}),
    ...(typeof message === 'string'
      ? { message: resolveText(message, languages, '', activeLang) }
      : {}),
    ...(typeof url === 'string' ? { url: resolveText(url, languages, '', activeLang) } : {}),
    ...(Array.isArray(actions)
      ? {
          actions: actions.map((action) => {
            const entry = action as Record<string, unknown>
            const { label, url: actionUrl } = entry
            return {
              ...entry,
              ...(typeof label === 'string'
                ? { label: resolveText(label, languages, '', activeLang) }
                : {}),
              ...(typeof actionUrl === 'string'
                ? { url: resolveText(actionUrl, languages, '', activeLang) }
                : {}),
            }
          }),
        }
      : {}),
  } as unknown as FormOnSuccess
}

/**
 * Resolve any `$t:` token in an `onError` payload's `message` against the
 * active locale. Returns the payload unchanged when the app has no `languages`
 * block.
 */
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
