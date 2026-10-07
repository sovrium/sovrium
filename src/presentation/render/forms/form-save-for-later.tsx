/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { serializeJsonForScript } from '@/domain/kernel/sanitize/json-script-serialization'
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import type { SaveForLaterLabels } from './form-save-for-later-labels'
import type { Languages } from '@/domain/models/app/languages'

/**
 * The control's behaviour, shipped verbatim. It posts the answers typed so far
 * — the form's own values, read as the submit reads them — with the address to
 * `POST /api/forms/{name}/drafts`, and says whether the link went out. The
 * address input carries no `name`, so it never rides along with a submission.
 */
const SAVE_FOR_LATER_SCRIPT = `(function () {
  var root = document.currentScript && document.currentScript.parentNode
  var form = root && root.closest('form')
  if (!root || !form || root.hasAttribute('data-bound')) return
  root.setAttribute('data-bound', '')
  var cfg = JSON.parse(root.querySelector('script[data-save-later-config]').textContent || '{}')
  var panel = root.querySelector('[data-save-later-panel]')
  var email = root.querySelector('[data-save-later-email]')
  var status = root.querySelector('[data-save-later-status]')
  function answers() {
    var out = {}
    new FormData(form).forEach(function (value, key) {
      if (typeof value !== 'string') return
      if (Object.prototype.hasOwnProperty.call(out, key)) out[key] = [].concat(out[key], value)
      else out[key] = value
    })
    return out
  }
  function say(text) {
    status.textContent = text
    status.removeAttribute('hidden')
  }
  root.querySelector('[data-save-later-open]').addEventListener('click', function () {
    panel.removeAttribute('hidden')
    email.focus()
  })
  root.querySelector('[data-save-later-send]').addEventListener('click', function () {
    fetch('/api/forms/' + encodeURIComponent(cfg.formName) + '/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: email.value, data: answers() }),
    })
      .then(function (response) {
        if (!response.ok) return say(cfg.failed)
        panel.setAttribute('hidden', '')
        say(cfg.sent)
      })
      .catch(function () {
        say(cfg.failed)
      })
  })
})()`

/** The address input and its send button, revealed by the action. */
function SaveForLaterPanel({
  inputId,
  labels,
}: {
  readonly inputId: string
  readonly labels: SaveForLaterLabels
}) {
  return (
    <div
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      data-save-later-panel=""
      hidden
    >
      <label
        htmlFor={inputId}
        className="flex flex-col gap-1 text-sm"
      >
        {labels.email}
        <input
          id={inputId}
          type="email"
          autoComplete="email"
          data-save-later-email=""
        />
      </label>
      <button
        type="button"
        data-component-type="button"
        data-save-later-send=""
        className={computeButtonDefaultClasses({ variant: 'secondary' })}
      >
        {labels.send}
      </button>
    </div>
  )
}

/** The notice an expired, used or unknown resume link opens the form with — never which. */
export function ResumeUnavailableNotice({
  link,
  lang,
  languages,
}: {
  readonly link: { readonly unavailable?: boolean } | undefined
  readonly lang: string | undefined
  readonly languages: Languages | undefined
}) {
  if (link?.unavailable !== true) return undefined
  return (
    <p
      className="form-notice text-sm"
      role="status"
      data-form-notice="resume-unavailable"
    >
      {resolveInterpreterString('form.resumeUnavailable', lang, languages)}
    </p>
  )
}

/**
 * "Save and continue later", beside a single-page form's submit
 * (`saveAndResume.enabled`). It sits inside the `<form>` but submits nothing:
 * both its buttons are `type="button"` and its address input has no name.
 */
export function SaveForLater({
  formName,
  labels,
}: {
  readonly formName: string
  readonly labels: SaveForLaterLabels
}) {
  const config = serializeJsonForScript({ formName, sent: labels.sent, failed: labels.failed })
  const inputId = `save-later-email-${formName}`
  return (
    <div
      className="form-save-later flex flex-col gap-2"
      data-form-save-later={formName}
    >
      <button
        type="button"
        data-component-type="button"
        data-save-later-open=""
        className={`${computeButtonDefaultClasses({ variant: 'secondary' })} w-full sm:w-auto sm:self-start`}
      >
        {labels.action}
      </button>
      <SaveForLaterPanel
        inputId={inputId}
        labels={labels}
      />
      <p
        className="text-sm"
        role="status"
        data-save-later-status=""
        hidden
      />
      <script
        type="application/json"
        data-save-later-config=""
        dangerouslySetInnerHTML={{ __html: config }}
      />
      <script dangerouslySetInnerHTML={{ __html: SAVE_FOR_LATER_SCRIPT }} />
    </div>
  )
}
