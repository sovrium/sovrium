/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTranslationTokensDeep } from '@/domain/models/app/languages/translation-resolver'
import { hostComponentType } from './island-host-attributes'
import type { ComponentRenderer } from './component-dispatch-config'

/** A label the author may override, with its default. */
const labelOf = (source: Readonly<Record<string, unknown>>, key: string, fallback: string) =>
  typeof source[key] === 'string' ? source[key] : fallback

/**
 * `questionnaire` — the host of the questionnaire island. Every screen is drawn
 * in the browser, where the answers are held until the one submission; the
 * server draws a quiet placeholder of the first screen's size. Prompts, choices
 * and button words are translated here, so the island receives final text.
 *
 * Source: src/domain/models/app/pages/components/component-types/data/questionnaire.ts
 */
const questionnaireComponent: ComponentRenderer = ({
  elementProps,
  component,
  currentLang,
  languages,
}) => {
  const source = (component ?? {}) as Readonly<Record<string, unknown>>
  const props = resolveTranslationTokensDeep(
    {
      formRef: source['formRef'],
      items: source['items'],
      showProgress: source['showProgress'] !== false,
      labels: {
        submit: labelOf(source, 'submitLabel', 'Submit'),
        next: labelOf(source, 'nextLabel', 'Next'),
        previous: labelOf(source, 'previousLabel', 'Previous'),
        skip: labelOf(source, 'skipLabel', 'Skip'),
        sent: 'Your answers were sent.',
        failed: 'Your answers could not be sent. Try again.',
      },
    },
    currentLang,
    languages
  )
  return (
    <div
      data-island="questionnaire"
      data-component-type={hostComponentType(elementProps)}
      data-island-props={JSON.stringify(props)}
      data-testid={elementProps['data-testid'] as string | undefined}
      id={elementProps['id'] as string | undefined}
      className={elementProps['className'] as string | undefined}
    >
      <div
        aria-hidden="true"
        className="flex w-full max-w-lg flex-col gap-3"
      >
        <div className="bg-muted h-4 w-24 animate-pulse rounded" />
        <div className="bg-muted h-5 w-64 animate-pulse rounded" />
        <div className="bg-muted h-11 w-full animate-pulse rounded-lg" />
        <div className="bg-muted h-11 w-full animate-pulse rounded-lg" />
      </div>
    </div>
  )
}

/** The questionnaire renderer, keyed by type. */
export const questionnaireComponents = {
  questionnaire: questionnaireComponent,
} as const satisfies Readonly<Record<string, ComponentRenderer>>
