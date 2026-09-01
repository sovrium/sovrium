/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * In-memory step-draft store for multi-step form navigation.
 *
 * Each submitter session (identified by a `sovrium_form_draft` cookie) has
 * one entry per active form. The entry merges every advance-step payload
 * the submitter has sent so subsequent steps can prefill values, the next-
 * step resolver can evaluate `goToWhen` rules, and the final submission
 * can omit values belonging to skipped steps.
 *
 * Storage choice: a process-local `Map`. Form drafts are inherently
 * ephemeral (they evaporate the moment the submitter closes the tab) and
 * the data set per session is small (typically 5–20 fields). The same
 * pattern powers `webhook-rate-limit.ts`. A future tier may promote this
 * to a database-backed store when save-and-resume lands; the helper
 * functions here keep that migration path narrow (only this file
 * touches the in-memory Map).
 *
 * The store does NOT include any TTL today. Tests run for at most a few
 * seconds per scenario and start/stop the server per test. A long-running
 * production deployment would want a TTL or LRU eviction; that's deferred
 * to the save-and-resume tier alongside the database-backed store.
 */

const drafts = new Map<string, Record<string, Record<string, unknown>>>()

/**
 * Generate a fresh session id for the draft cookie. Keeps the cookie
 * value short (≈22 base64 chars) and unguessable.
 */
export function generateDraftSessionId(): string {
  const bytes = new Uint8Array(16)
  // eslint-disable-next-line functional/no-expression-statements -- crypto API mutates the buffer in place
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Read the draft for a given (session, form). Returns an empty record
 * when no advance has been recorded yet.
 */
export function readDraft(sessionId: string, formName: string): Readonly<Record<string, unknown>> {
  return drafts.get(sessionId)?.[formName] ?? {}
}

/**
 * Merge an advance-step payload into the existing draft. Fields the
 * submitter passes in `values` overwrite any prior value for the same
 * key; fields the submitter does NOT pass are left untouched (so a
 * Previous-then-edit-just-one-field flow does not nuke unrelated values).
 */
export function mergeDraft(
  sessionId: string,
  formName: string,
  values: Readonly<Record<string, unknown>>
): void {
  const existingForSession = drafts.get(sessionId) ?? {}
  const existingForForm = existingForSession[formName] ?? {}
  const merged: Record<string, unknown> = { ...existingForForm, ...values }
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- module-local mutable Map, mirrors webhook-rate-limit.ts pattern
  drafts.set(sessionId, { ...existingForSession, [formName]: merged })
}

/**
 * REPLACE a form's draft with exactly `values`, dropping everything the
 * submitter had entered before.
 *
 * This is the server half of `onSuccess: { type: 'reset' }` on a multi-step
 * form. A reset means the submitter starts the flow over, so every answer
 * they gave must stop prefilling later steps — but `preserveFields` says
 * some answers deliberately survive. Merging cannot express that (it can
 * only add), and clearing alone loses the preserved values, so the two have
 * to happen as one replacement.
 *
 * Passing an empty `values` is therefore a full clear, which is the correct
 * behaviour for a reset with no `preserveFields`.
 */
export function replaceDraft(
  sessionId: string,
  formName: string,
  values: Readonly<Record<string, unknown>>
): void {
  const existingForSession = drafts.get(sessionId) ?? {}
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- module-local mutable Map, mirrors webhook-rate-limit.ts pattern
  drafts.set(sessionId, { ...existingForSession, [formName]: { ...values } })
}

// `resetDraftStore` (a test-only escape hatch to empty the whole Map) is
// intentionally NOT exported today — specs start a fresh server per test, so
// it has no caller. Add it the moment one lands.
