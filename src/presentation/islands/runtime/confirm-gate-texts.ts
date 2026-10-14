/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  substituteRecordVars,
  withRecordText,
} from '@/domain/models/app/pages/substitute-record-vars'
import { restoreInertTemplateValue } from '@/presentation/design/session-template'
import { nullable, READ_ONCE_QUERY_OPTIONS } from './query-client'
import { fetchSessionUser, resolveSessionTemplate } from './session-resolver'
import type { ConfirmObject } from '@/domain/models/app/pages/components/confirm-gate'

/**
 * The words and the type-to-confirm value of an object-form `confirm` gate,
 * shared by every surface that asks the question: the inline gate a record
 * drawer draws and the data grid's modal row-action dialog.
 */

/**
 * Resolve `$record.<field>` references in a `matchValue` against the row record,
 * through the one shared reader — an escaped `\$record.x` is the phrase itself.
 */
function resolveRecordTemplate(
  template: string,
  record: Readonly<Record<string, unknown>> | undefined
): string {
  return record === undefined ? template : substituteRecordVars(template, record)
}

/**
 * Resolve a type-to-confirm `matchValue` against the caller's own session (for a
 * `$session.<field>` token) and the row record (`$record.<field>`). A non-session
 * matchValue resolves synchronously; a `$session.` token resolves once the
 * session fetch returns. `undefined` means "not yet resolved / no gate".
 */
export function useResolvedMatchValue(
  rawMatch: string | undefined,
  record: Record<string, unknown> | undefined
): string | undefined {
  const [matchValue, setMatchValue] = useState<string | undefined>(() =>
    rawMatch !== undefined && !rawMatch.includes('$session.')
      ? restoreInertTemplateValue(resolveRecordTemplate(rawMatch, record))
      : undefined
  )
  // Only a `$session.`-bearing template needs the identity; everything else was
  // already resolved in the initial state above and never asks.
  const needsSession = rawMatch !== undefined && rawMatch.includes('$session.')
  const { data: user } = useQuery({
    queryKey: ['session-user'],
    queryFn: nullable(fetchSessionUser),
    enabled: needsSession,
    ...READ_ONCE_QUERY_OPTIONS,
  })

  useEffect(() => {
    if (!needsSession || user === undefined) return
    // A value the server filled in is restored LAST, after every token resolved.
    setMatchValue(
      restoreInertTemplateValue(
        resolveRecordTemplate(resolveSessionTemplate(rawMatch ?? '', user ?? undefined), record)
      )
    )
  }, [needsSession, user, rawMatch, record])
  return matchValue
}

/**
 * The words an object-form gate shows: its title and message with `$record.*`
 * filled from the row it was armed for, and its two button labels.
 *
 * The title and message are TEXT sites: a record that carries its formatted text
 * (a record drawer's, `withRecordTextFields`) prints it there, exactly as the
 * server prints the same value on a record page; `<field>.raw` keeps the stored
 * value. The type-to-confirm `matchValue` is a VALUE site and reads the record
 * as stored ({@link useResolvedMatchValue}).
 */
export function gateTexts(
  config: ConfirmObject,
  record: Record<string, unknown> | undefined,
  fallbackConfirmLabel: string,
  fallbackCancelLabel: string
): { title: string; message: string; confirmLabel: string; cancelLabel: string } {
  const text = record === undefined ? undefined : withRecordText(record)
  return {
    title: resolveRecordTemplate(config.title ?? config.message, text),
    message: resolveRecordTemplate(config.message, text),
    confirmLabel: config.confirmLabel ?? fallbackConfirmLabel,
    cancelLabel: config.cancelLabel ?? fallbackCancelLabel,
  }
}
