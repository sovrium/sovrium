/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useContext } from 'react'
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { computePartButtonClasses } from '@/presentation/design/button-variant-classes'
import {
  hostClassName,
  hostComponentType,
} from '@/presentation/render/registry/island-host-attributes'
import { resolveChildTranslation } from '../i18n/translation-handler'
import { ConsentPurposesContext } from './consent-purposes-context'
import type { Languages } from '@/domain/models/app/languages'
import type { ReactElement } from 'react'

/** Shape of the schema-authored `consent-choice` component. */
export interface ConsentChoiceComponent {
  readonly purpose?: string
  readonly label?: string
  readonly grantedText?: string
  readonly deniedText?: string
  readonly signalText?: string
  readonly noScriptText?: string
}

/**
 * The toggle draws shadcn/ui's outline button; pressed (the purpose is on), it
 * takes the muted ground a pressed toggle shows. The focus ring comes with the
 * button recipe, so the keyboard user always sees where they are.
 */
const TOGGLE_CLASSES = `${computePartButtonClasses({ variant: 'outline' })} aria-pressed:bg-muted`

/** The status line under the toggle. */
const STATUS_CLASSES = 'text-sm text-muted-foreground'

/**
 * The engine's own wording for one part of the control. `analytics` has its full
 * catalogue; another purpose has a generic status, and no signal or no-script
 * sentence, since no signal holds it and the author alone can say what it does.
 */
const catalogueKey = (purpose: string, part: string): string | undefined => {
  if (purpose === 'analytics') return `consent.analytics.${part}`
  return part === 'granted' || part === 'denied' ? `consent.purpose.${part}` : undefined
}

/**
 * Renderer for the `consent-choice` component: a visitor's own on-or-off
 * choice about one purpose.
 *
 * The server cannot read the visitor's browser, so it draws the control
 * HIDDEN and in its default state (pressed, the measured status), and the
 * body-end consent runtime (`consent-choice-script.ts`) reads the stored
 * choice and the privacy signals, sets the real state, reveals it and hides
 * the no-script message, all during the parse. Without JavaScript nothing
 * runs: the message stays in place of the control, and the tracker, which is
 * JavaScript too, never sends anything.
 *
 * The message is an ordinary paragraph the runtime hides, not a `<noscript>`:
 * a browser whose scripts are switched off by a policy or a tool, rather than
 * by its own setting, still parses `<noscript>` as raw text and shows nothing,
 * which would leave that visitor with neither the control nor the message.
 *
 * The button's name never changes; `aria-pressed` carries the choice, and the
 * polite `role="status"` line says what is happening now. The texts the
 * runtime swaps in (turned off, held off by a privacy signal) travel as
 * `data-*` attributes, already resolved in the page language.
 */
export function ConsentChoiceControl({
  authored,
  elementProps,
  currentLang,
  languages,
}: {
  readonly authored: ConsentChoiceComponent
  readonly elementProps: Record<string, unknown>
  readonly currentLang: string | undefined
  readonly languages: Languages | undefined
}): ReactElement {
  const purpose = authored.purpose ?? 'analytics'
  const declared = useContext(ConsentPurposesContext)?.find((entry) => entry.id === purpose)
  const text = (value: string | undefined, part: string): string => {
    const own = value || (part === 'label' ? declared?.label : undefined)
    if (own) return resolveChildTranslation(own, currentLang, languages)
    const key = catalogueKey(purpose, part)
    return key === undefined ? '' : resolveInterpreterString(key, currentLang, languages)
  }
  const noScript = text(authored.noScriptText, 'noScript')

  return (
    <div
      data-consent-choice="true"
      data-purpose={purpose}
      data-component-type={hostComponentType(elementProps)}
      data-testid={elementProps['data-testid'] as string | undefined}
      data-granted-text={text(authored.grantedText, 'granted')}
      data-denied-text={text(authored.deniedText, 'denied')}
      data-signal-text={text(authored.signalText, 'signal')}
      className={hostClassName(elementProps, 'flex flex-col items-start gap-2')}
    >
      <button
        type="button"
        hidden
        data-consent-toggle="true"
        aria-pressed="true"
        className={TOGGLE_CLASSES}
      >
        {text(authored.label, 'label')}
      </button>
      <p
        role="status"
        aria-live="polite"
        hidden
        data-consent-status="true"
        className={STATUS_CLASSES}
      >
        {text(authored.grantedText, 'granted')}
      </p>
      {noScript.length > 0 && (
        <p
          data-consent-noscript="true"
          className={STATUS_CLASSES}
        >
          {noScript}
        </p>
      )}
    </div>
  )
}
