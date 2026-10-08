/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRecord, type Raw } from '@/domain/kernel/config-parsing/plain-object'

/**
 * WHAT A DOCUMENT TEMPLATE NAMES MUST EXIST: ITS PARTIALS, ITS TRANSLATION
 * KEYS, ITS STEP'S LANGUAGE.
 *
 * At the app root because each rule relates an action's own template to
 * another property: a partial `{{> name}}` to the `partial` assets, a
 * `{{t 'key'}}` to `languages.translations` of the default language, and a
 * literal `locale` to `languages.supported`. Only what the config can know is
 * checked — an inline template here, an asset template once its file is read
 * ({@link validateAssetTemplateReferences}); a template stored in a bucket is
 * checked when it renders, and a templated locale falls back to the default
 * language at run time.
 */

/** The props of an action that hold its own templates. */
const TEMPLATE_PROPS: ReadonlyArray<string> = ['template', 'text', 'subject', 'header', 'footer']

/** `{{> name}}` and `{{#> name}}…`, the name written in the template. */
const PARTIAL_TAG = /\{\{~?#?>\s*([^\s}~()"']+)/g
/** `{{t 'key'}}` / `{{t "key"}}`, the key written in the template. */
const TRANSLATION_TAG = /\{\{~?\s*t\s+(["'])([^"']+)\1/g

/** The partials a template names, `@partial-block` aside. */
export const partialNamesIn = (template: string): ReadonlyArray<string> =>
  [...new Set([...template.matchAll(PARTIAL_TAG)].map((match) => match[1] ?? ''))].filter(
    (name) => name !== '' && name !== '@partial-block'
  )

/** The translation keys a template prints with `{{t}}`. */
export const translationKeysIn = (template: string): ReadonlyArray<string> => [
  ...new Set([...template.matchAll(TRANSLATION_TAG)].map((match) => match[2] ?? '')),
]

/** A partial's name: its asset path without the extension. */
const partialName = (path: string): string => path.replace(/\.[^./]+$/, '')

const PARTIAL_EXTENSION = /\.hbs$/i

/** The names the `partial` assets declare (a `.hbs` file, or an entry of kind `partial`). */
const declaredPartials = (config: Raw): ReadonlySet<string> =>
  new Set(
    (Array.isArray(config['assets']) ? config['assets'] : [])
      .filter(isRecord)
      .filter(
        (entry) =>
          entry['kind'] === 'partial' ||
          (entry['kind'] === undefined && PARTIAL_EXTENSION.test(String(entry['path'])))
      )
      .map((entry) => partialName(String(entry['path'])))
  )

interface Languages {
  readonly codes: ReadonlyArray<string>
  readonly locales: ReadonlyArray<string>
  readonly defaultCode: string | undefined
  readonly knownKeys: ReadonlySet<string> | undefined
}

const languagesOf = (config: Raw): Languages => {
  const languages = isRecord(config['languages']) ? config['languages'] : {}
  const supported = (Array.isArray(languages['supported']) ? languages['supported'] : []).filter(
    isRecord
  )
  const defaultCode = typeof languages['default'] === 'string' ? languages['default'] : undefined
  const translations = isRecord(languages['translations']) ? languages['translations'] : {}
  const dictionary = defaultCode === undefined ? undefined : translations[defaultCode]
  const anyKeys = Object.values(translations).flatMap((entry) =>
    isRecord(entry) ? Object.keys(entry) : []
  )
  return {
    codes: supported.map((entry) => String(entry['code'])),
    locales: supported.flatMap((entry) =>
      typeof entry['locale'] === 'string' ? [entry['locale']] : []
    ),
    defaultCode,
    // A key one language defines resolves through the fallback chain in the
    // others; only a key NO language defines is a typo the config can catch.
    knownKeys: isRecord(dictionary) ? new Set(anyKeys) : undefined,
  }
}

/** One action step anywhere under `value`, with the automation or template that holds it. */
interface Step {
  readonly owner: string
  readonly name: string
  readonly type: unknown
  readonly operator: unknown
  readonly props: Raw
}

const stepsIn = (owner: string, value: unknown): ReadonlyArray<Step> => {
  if (Array.isArray(value)) return value.flatMap((item) => stepsIn(owner, item))
  if (!isRecord(value)) return []
  const own =
    typeof value['type'] === 'string' && isRecord(value['props'])
      ? [
          {
            owner,
            name: String(value['name'] ?? value['type']),
            type: value['type'],
            operator: value['operator'],
            props: value['props'],
          },
        ]
      : []
  return [...own, ...Object.values(value).flatMap((child) => stepsIn(owner, child))]
}

const everyStep = (config: Raw): ReadonlyArray<Step> => [
  ...(Array.isArray(config['automations']) ? config['automations'] : [])
    .filter(isRecord)
    .flatMap((automation) =>
      stepsIn(`automation "${String(automation['name'])}"`, automation['actions'])
    ),
  ...(Array.isArray(config['actions']) ? config['actions'] : [])
    .filter(isRecord)
    .flatMap((template) =>
      stepsIn(`action template "${String(template['name'])}"`, template['action'])
    ),
]

/** What one template names that does not exist, as messages. */
const templateIssues = (
  where: string,
  template: string,
  partials: ReadonlySet<string>,
  languages: Languages
): ReadonlyArray<string> => [
  ...partialNamesIn(template)
    .filter((name) => !partials.has(name))
    .map((name) => `${where} includes partial "${name}", which no partial asset declares`),
  ...(languages.knownKeys === undefined
    ? []
    : translationKeysIn(template)
        .filter((key) => !languages.knownKeys?.has(key))
        .map(
          (key) =>
            `${where} translates "${key}", which languages.translations.${languages.defaultCode ?? ''} does not define`
        )),
]

/**
 * The steps whose `locale` is a template language — the document generators
 * and `email/send`. Elsewhere (`date/format`, …) `locale` is a BCP 47 tag for
 * formatting, not a declared language.
 */
const takesTemplateLocale = (step: Step): boolean =>
  step.type === 'document' || (step.type === 'email' && step.operator === 'send')

/** A literal `locale` naming no declared language. */
const localeIssue = (step: Step, languages: Languages): ReadonlyArray<string> => {
  if (!takesTemplateLocale(step)) return []
  const { locale } = step.props
  if (typeof locale !== 'string' || locale.includes('{{')) return []
  if (languages.codes.includes(locale) || languages.locales.includes(locale)) return []
  const declared = languages.codes.length === 0 ? 'none declared' : languages.codes.join(', ')
  return [
    `${step.owner}: step "${step.name}" — locale "${locale}" is not a declared language (${declared})`,
  ]
}

/** The template sources of a step: `[prop, source]`. */
const sourcesOf = (step: Step): ReadonlyArray<readonly [string, Raw]> =>
  TEMPLATE_PROPS.flatMap((prop) => {
    const source = step.props[prop]
    return isRecord(source) ? [[prop, source] as const] : []
  })

/**
 * Every inline template naming a partial no asset declares or a key the
 * default language lacks, and every literal `locale` naming no declared
 * language — one message each, naming the automation and the step.
 */
export const validateTemplateReferences = (normalized: unknown): readonly string[] => {
  if (!isRecord(normalized)) return []
  const partials = declaredPartials(normalized)
  const languages = languagesOf(normalized)
  return everyStep(normalized).flatMap((step) => [
    ...localeIssue(step, languages),
    ...sourcesOf(step).flatMap(([prop, source]) =>
      typeof source['inline'] === 'string'
        ? templateIssues(
            `${step.owner}: the ${prop} of step "${step.name}"`,
            source['inline'],
            partials,
            languages
          )
        : []
    ),
  ])
}

/**
 * The same checks for the asset templates a step reads, once their files are
 * read: `assetText` answers a declared asset's text.
 */
export const validateAssetTemplateReferences = (
  normalized: unknown,
  assetText: (path: string) => string | undefined
): readonly string[] => {
  if (!isRecord(normalized)) return []
  const partials = declaredPartials(normalized)
  const languages = languagesOf(normalized)
  const paths = new Set(
    everyStep(normalized).flatMap((step) =>
      sourcesOf(step).flatMap(([, source]) =>
        typeof source['asset'] === 'string' ? [source['asset']] : []
      )
    )
  )
  return [...paths].flatMap((path) => {
    const text = assetText(path)
    return text === undefined
      ? []
      : templateIssues(`template asset "${path}"`, text, partials, languages)
  })
}
