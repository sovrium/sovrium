/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { computePartButtonClasses } from '@/presentation/design/button-variant-classes'
import { CARD_PART_CLASSES, computeCardClasses } from '@/presentation/design/card-default-classes'
import {
  computeFormCheckboxClasses,
  computeFormCheckboxFieldClasses,
  computeFormCheckboxTextClasses,
} from '@/presentation/design/forms-default-classes'
import { buildConsentBannerScript } from '@/presentation/render/scripts/consent-banner-script'
import { resolveChildTranslation } from '../i18n/translation-handler'
import type { PageConsent } from './analytics-beacon-script'
import type { ConsentPurposeDeclaration } from '@/domain/models/app/consent'
import type { ReactElement } from 'react'

const TITLE_ID = 'consent-banner-title'

/**
 * Bottom inline-end corner, over the page with no backdrop; logical, so RTL
 * follows. A floating "Built with Sovrium" badge is an earlier sibling in the
 * same corner, so the region rises clear of it, with no script and no prop.
 */
const REGION_CLASSES =
  'fixed end-4 bottom-(--consent-banner-offset) z-50 w-[calc(100%-2rem)] max-w-md [--consent-banner-offset:--spacing(4)] [[data-sovrium-badge=floating]~&]:[--consent-banner-offset:--spacing(14)]'

/** The card scrolls on a short viewport, so its own ring and shadow are never clipped. */
const CARD_FLOATING_CLASSES =
  'max-h-[calc(100dvh-var(--consent-banner-offset)-1rem)] overflow-y-auto shadow-lg'

/** Refuse, Accept and Save draw this one class, so no choice is easier to see than another. */
const ACTION_CLASSES = computePartButtonClasses({ variant: 'outline' })

const PURPOSE_NAME_CLASSES = 'text-sm font-medium'
const PURPOSE_TEXT_CLASSES = 'text-sm text-muted-foreground'
const PURPOSE_LIST_CLASSES = 'flex flex-col gap-3'
const FOOTER_LAYOUT_CLASSES = 'flex-wrap gap-2'

/** One purpose alone needs no box: `Accept all` and `Refuse all` already say it all. */
function SinglePurpose({
  label,
  description,
}: {
  readonly id: string
  readonly label: string
  readonly description: string
}): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <p className={PURPOSE_NAME_CLASSES}>{label}</p>
      <p className={PURPOSE_TEXT_CLASSES}>{description}</p>
    </div>
  )
}

/** One unticked box per purpose, named by the purpose's label alone. */
function PurposeCheckbox({
  id,
  label,
  description,
}: {
  readonly id: string
  readonly label: string
  readonly description: string
}): ReactElement {
  const labelId = `consent-purpose-${id}-label`
  const descriptionId = `consent-purpose-${id}-description`
  return (
    <label className={computeFormCheckboxFieldClasses()}>
      <input
        type="checkbox"
        data-consent-purpose={id}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        className={computeFormCheckboxClasses()}
      />
      <span className={computeFormCheckboxTextClasses()}>
        <span
          id={labelId}
          className={PURPOSE_NAME_CLASSES}
        >
          {label}
        </span>
        <span
          id={descriptionId}
          className={PURPOSE_TEXT_CLASSES}
        >
          {description}
        </span>
      </span>
    </label>
  )
}

type EngineText = (part: string) => string

function BannerHeader({
  engine,
  policyHref,
}: {
  readonly engine: EngineText
  readonly policyHref: string
}): ReactElement {
  return (
    <div
      data-slot="card-header"
      className={CARD_PART_CLASSES.header}
    >
      <h2
        id={TITLE_ID}
        data-slot="card-title"
        className={CARD_PART_CLASSES.title}
      >
        {engine('title')}
      </h2>
      <p
        data-slot="card-description"
        className={CARD_PART_CLASSES.description}
      >
        {engine('description')}{' '}
        <a
          href={policyHref}
          className="underline underline-offset-4"
        >
          {engine('policyLink')}
        </a>
      </p>
    </div>
  )
}

/** Every action draws the same button; only the runtime tells them apart. */
function BannerAction({
  action,
  children,
}: {
  readonly action: 'refuse' | 'accept' | 'save'
  readonly children: string
}): ReactElement {
  return (
    <button
      type="button"
      data-slot="button"
      data-consent-action={action}
      className={ACTION_CLASSES}
    >
      {children}
    </button>
  )
}

type BannerPurpose = {
  readonly id: string
  readonly label: string
  readonly description: string
}

function BannerCard({
  engine,
  policyHref,
  purposes,
}: {
  readonly engine: EngineText
  readonly policyHref: string
  readonly purposes: readonly BannerPurpose[]
}): ReactElement {
  const [only] = purposes
  return (
    <div
      data-slot="card"
      data-size="default"
      className={`${computeCardClasses({ sliced: true })} ${CARD_FLOATING_CLASSES}`}
    >
      <BannerHeader
        engine={engine}
        policyHref={policyHref}
      />
      <div
        data-slot="card-content"
        className={CARD_PART_CLASSES.content}
      >
        {purposes.length === 1 && only !== undefined ? (
          <SinglePurpose {...only} />
        ) : (
          <div className={PURPOSE_LIST_CLASSES}>
            {purposes.map((purpose) => (
              <PurposeCheckbox
                key={purpose.id}
                {...purpose}
              />
            ))}
          </div>
        )}
      </div>
      <div
        data-slot="card-footer"
        className={`${CARD_PART_CLASSES.footer} ${FOOTER_LAYOUT_CLASSES}`}
      >
        <BannerAction action="refuse">{engine('refuseAll')}</BannerAction>
        <BannerAction action="accept">{engine('acceptAll')}</BannerAction>
        {purposes.length > 1 && <BannerAction action="save">{engine('saveChoices')}</BannerAction>}
      </div>
    </div>
  )
}

/**
 * The consent banner: server-rendered markup and one inline script, no island.
 *
 * Every visitor gets the same HTML, drawn hidden; the script right after it
 * reveals the region when this browser has no current answer, before the first
 * paint. Without JavaScript it stays hidden, and nothing it gates runs either.
 *
 * A non-modal region named by its heading: it takes no focus, traps none and
 * blocks nothing, and the outcome is announced from a status line that outlives
 * it. It comes after every held script tag of the page, so its script finds them
 * all.
 */
export function ConsentBanner({
  consent,
  lang,
}: {
  readonly consent: PageConsent
  readonly lang: string | undefined
}): ReactElement {
  const { declaration, languages } = consent
  const engine: EngineText = (part) =>
    resolveInterpreterString(`consent.banner.${part}`, lang, languages)
  const purposes = declaration.purposes.map((purpose: ConsentPurposeDeclaration) => ({
    id: purpose.id,
    label: resolveChildTranslation(purpose.label, lang, languages),
    description: resolveChildTranslation(purpose.description, lang, languages),
  }))

  return (
    <>
      <section
        hidden
        data-consent-banner="true"
        data-component-type="consent-banner"
        role="region"
        aria-labelledby={TITLE_ID}
        className={REGION_CLASSES}
      >
        <BannerCard
          engine={engine}
          policyHref={declaration.policyHref}
          purposes={purposes}
        />
      </section>
      <div
        role="status"
        aria-live="polite"
        data-consent-outcome="true"
        data-saved-text={engine('saved')}
        className="sr-only"
      />
      <div
        hidden
        aria-hidden="true"
        data-consent-spacer="true"
      />
      <script
        // eslint-disable-next-line sovrium/require-sanitized-html -- engine-authored runtime; its config values are encoded by serializeJsonForScript in consent-record-script.ts
        dangerouslySetInnerHTML={{ __html: buildConsentBannerScript(declaration) }}
      />
    </>
  )
}
