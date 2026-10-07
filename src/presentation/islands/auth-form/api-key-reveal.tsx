/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A new API key, shown once. Leaving the screen forgets it, so the reader
 * confirms they copied it before Done lets them leave — the same guard the
 * recovery codes of a two-step enrolment carry. Placed in a dialog, Done
 * closes it, back on the list the new key now heads.
 */

import { useState, type ReactElement } from 'react'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { computeFormLayoutClasses } from '@/presentation/design/form-layout-classes'

const BUTTON_CLASSES = `${computeButtonDefaultClasses()} w-full`

/** The key, the copied confirmation, and Done once it is ticked. */
export function KeyReveal({
  secret,
  onDone,
}: {
  readonly secret: string
  readonly onDone: () => void
}): ReactElement {
  const [copied, setCopied] = useState(false)
  return (
    <div className={computeFormLayoutClasses()}>
      <p>Copy this key now — it will not be shown again.</p>
      <code
        data-testid="api-key-secret"
        className="font-mono break-all"
      >
        {secret}
      </code>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={copied}
          onChange={(event) => setCopied(event.target.checked)}
        />
        I have copied this key
      </label>
      {/* `data-dialog-cancel`: in a dialog, Done also closes it. */}
      <button
        type="button"
        data-component-type="button"
        data-dialog-cancel=""
        disabled={!copied}
        className={BUTTON_CLASSES}
        onClick={onDone}
      >
        Done
      </button>
    </div>
  )
}
