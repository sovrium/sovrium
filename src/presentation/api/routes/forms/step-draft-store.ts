/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


const drafts = new Map<string, Record<string, Record<string, unknown>>>()

export function generateDraftSessionId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function readDraft(sessionId: string, formName: string): Readonly<Record<string, unknown>> {
  return drafts.get(sessionId)?.[formName] ?? {}
}

export function mergeDraft(
  sessionId: string,
  formName: string,
  values: Readonly<Record<string, unknown>>
): void {
  const existingForSession = drafts.get(sessionId) ?? {}
  const existingForForm = existingForSession[formName] ?? {}
  const merged: Record<string, unknown> = { ...existingForForm, ...values }
  drafts.set(sessionId, { ...existingForSession, [formName]: merged })
}

