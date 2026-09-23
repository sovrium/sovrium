/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the engine made of the last save — the one thing nothing else can tell
 * the user.
 *
 * ## Why this screen has to exist at all
 *
 * When Sovrium refuses a configuration it does **not** stop. The last good
 * version keeps serving, the page keeps answering 200, the window keeps showing
 * the app. Every signal a person has says "fine" while the file they just
 * edited sits on disk unread. `status.json` is the only channel that
 * distinguishes those two situations, and this is the only place the shell
 * renders it.
 *
 * ## Three outcomes, three different situations
 *
 * `kept`, `rolled-back` and `down` are not three shades of one failure, and the
 * copy treats them as the different events they are: nothing stopped; something
 * stopped and recovered; nothing is answering. A user who reads "your app is
 * down" when it is serving perfectly will go looking for an outage that does not
 * exist, and one who reads "not applied" during a real outage will not go
 * looking at all.
 *
 * ## The findings are the deliverable
 *
 * `accepted` is the only field that says what to write instead, and the engine
 * documents it as never elided — so it is rendered whole, and the copy button
 * exports it whole. The paste target is an AI assistant: a person who cannot
 * read `pages[0].components[2].type` can still hand those three lines to the
 * thing that wrote them.
 */

import { ai, verdict as copy } from '../copy'
import { copyText, h } from '../dom'
import type { ConfigFinding, StatePayload, StatusReloadRecord } from '../bridge'

/** The outcomes worth interrupting someone for. `success` is not one of them. */
type Refusal = 'kept' | 'rolled-back' | 'down'

const REFUSALS: Record<Refusal, { readonly title: string; readonly lead: string }> = {
  kept: copy.kept,
  'rolled-back': copy.rolledBack,
  down: copy.down,
}

/**
 * The refusal to show, or `null`.
 *
 * Reads `lastReload.outcome` rather than `state`, because the two answer
 * different questions and only this one is about the user's last save. A
 * missing or unrecognised outcome shows nothing at all: an engine newer than
 * this shell may publish a value invented after it was written, and inventing a
 * screen for it would be worse than staying quiet.
 */
const refusalOf = (record: StatusReloadRecord | null | undefined): Refusal | null => {
  const outcome = record?.outcome
  return outcome === 'kept' || outcome === 'rolled-back' || outcome === 'down' ? outcome : null
}

/** One finding as plain text, for the clipboard. */
const findingText = (finding: ConfigFinding): string => {
  const where = finding.path === '' ? '' : `${finding.path}: `
  const accepted =
    finding.accepted === undefined || finding.accepted.length === 0
      ? ''
      : `\n  ${copy.acceptedPrefix} ${finding.accepted.join(', ')}`
  const source = finding.sourceFile === undefined ? '' : `\n  in ${finding.sourceFile}`
  return `- ${where}${finding.message}${accepted}${source}`
}

const findingItem = (finding: ConfigFinding): HTMLElement =>
  h(
    'li',
    { class: 'finding' },
    finding.path === '' ? null : h('code', { class: 'finding__path' }, finding.path),
    h('p', { class: 'finding__message' }, finding.message),
    finding.accepted === undefined || finding.accepted.length === 0
      ? null
      : h(
          'p',
          { class: 'finding__accepted' },
          `${copy.acceptedPrefix} ${finding.accepted.join(', ')}`
        ),
    finding.sourceFile === undefined
      ? null
      : h('p', { class: 'finding__source' }, `in ${finding.sourceFile}`)
  )

/**
 * Is the engine reporting that nothing is listening?
 *
 * The shell's own `ShellState` cannot answer this. It is set to `serving` when
 * the engine writes its lock file and answers a probe, and it is not re-probed
 * afterwards — so a rollback that leaves the process alive but not listening
 * keeps the shell saying `serving` while `status.json` says `down`. Callers use
 * this to avoid offering to open an app that will refuse the connection.
 */
export const engineIsDown = (payload: StatePayload): boolean =>
  refusalOf(payload.engine?.lastReload) === 'down'

/**
 * Render the engine's verdict, or nothing.
 *
 * Returns `null` when the last save was applied — the overwhelmingly common
 * case, and the one where a panel saying "all good" would be noise on every
 * screen that composes this.
 */
export const engineVerdict = (payload: StatePayload): HTMLElement | null => {
  const record = payload.engine?.lastReload ?? null
  const refusal = refusalOf(record)
  if (refusal === null) return null

  const findings = record?.findings ?? []
  const { title, lead } = REFUSALS[refusal]

  const copyButton =
    findings.length === 0
      ? null
      : h('button', { class: 'button', type: 'button' }, copy.copyFindings)
  if (copyButton !== null) {
    copyButton.addEventListener('click', () => {
      const text = `${title}\n\n${findings.map(findingText).join('\n')}`
      void copyText(text).then((ok) => {
        copyButton.textContent = ok ? ai.copied : ai.copyFailed
        window.setTimeout(() => {
          copyButton.textContent = copy.copyFindings
        }, 2000)
      })
    })
  }

  return h(
    'section',
    {
      // Only `down` is an outage, and only `down` is painted as one. After a
      // rollback the app is answering again, so red would be a lie told in
      // colour — and `kept` never stopped at all. The other two are
      // distinguished by structure and by their heading, which is what a
      // design language with one colour ramp requires.
      class: refusal === 'down' ? 'panel panel--error' : 'panel panel--notice',
      role: 'status',
      'aria-live': 'polite',
      'data-testid': `verdict-${refusal}`,
    },
    h('h2', { class: 'panel__title' }, title),
    h('p', { class: 'panel__lead' }, lead),
    findings.length === 0
      ? h('p', { class: 'panel__note' }, copy.noFindings)
      : h(
          'div',
          { class: 'findings' },
          h('h3', { class: 'panel__subtitle' }, copy.findingsHeading),
          h('ul', { class: 'findings__list' }, ...findings.map(findingItem))
        ),
    copyButton === null
      ? null
      : h(
          'div',
          { class: 'form__actions form__actions--aligned' },
          copyButton,
          h('span', { class: 'panel__note' }, copy.copyHint)
        )
  )
}
