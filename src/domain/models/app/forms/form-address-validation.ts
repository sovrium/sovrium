/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Where a form may send its visitor.
 *
 * Six fields name an address a form sends its visitor to once it has been
 * sent (or while it is closed): a redirect's `url`, a success-page button's
 * `url`, a success page's `buttonHref`, a closed form's `cta.href`, and an
 * action response's `navigate` and `redirect`. Each is one of:
 *
 * - an `http://` or `https://` address, the scheme spelled out in any case;
 * - a path on this site: `/thanks` (one slash, not followed by `/` or `\`),
 *   `thanks`, `./thanks`, `../thanks` (a first segment with no `:`),
 *   `?sent=1`, `#done`;
 * - a `$t:` key, whose every translation must itself be one of the above
 *   ({@link validateTranslatedFormAddresses}).
 *
 * The rule reads what the author WROTE, before any `$record.` / `$submission.`
 * substitution: a variable may not open the address, nor sit in a relative
 * path's first segment, because its value could supply a scheme. An address
 * holding any whitespace or control character is refused outright — a browser
 * strips some of them before it reads the scheme (`java\tscript:`).
 */
export const FORM_ADDRESS_PATTERN =
  // eslint-disable-next-line no-control-regex -- the control range is the point: an address carrying one is refused
  /^(?![\s\S]*[\s\u0000-\u001f\u007f])(?:[Hh][Tt][Tt][Pp][Ss]?:\/\/\S+|\/(?![/\\])\S*|[?#]\S*|\$t:\S+|[^:/\\?#$\s]+(?:[/\\?#]\S*)?)$/

/** True when `address` is an address a form may send its visitor to. */
export const isFormAddress = (address: string): boolean => FORM_ADDRESS_PATTERN.test(address)

/** `//host/x` and `/\host/x` leave the site without naming a scheme. */
const protocolRelativeRest = (address: string): string | undefined =>
  /^\/[/\\]/.test(address) ? address.slice(2) : undefined

/** A template variable opening the address, or in a relative path's first segment. */
const opensWithVariable = (address: string): boolean => /^[^:/\\?#\s]*\$(?!t:)/.test(address)

/**
 * The refusal for an address a form may not send its visitor to. The value is
 * quoted with `JSON.stringify`, so a control character in it cannot break the
 * report's line.
 */
export const formAddressMessage = (address: string): string => {
  const base = `A form can only send its visitor to an http:// or https:// address or to a path on this site (/thanks, thanks, ?sent=1, #done); got ${JSON.stringify(address)}`
  const rest = protocolRelativeRest(address)
  if (rest !== undefined) {
    return `${base}. An address starting with two slashes leaves this site without naming its scheme: write "https://${rest}" to send the visitor there.`
  }
  if (opensWithVariable(address)) {
    return `${base}. A template variable may fill the path or the query of an address, never its start.`
  }
  return base
}

/** Schema check for one of the six form-address fields. */
export const formAddressCheck = Schema.makeFilter<string>(
  (address) => isFormAddress(address) || formAddressMessage(address),
  { toJsonSchema: () => ({ pattern: FORM_ADDRESS_PATTERN.source }) }
)

// ---------------------------------------------------------------------------
// `$t:` addresses, checked in every language
// ---------------------------------------------------------------------------

interface FoundAddress {
  readonly path: string
  readonly address: string
}

interface TranslatedAddressApp {
  readonly languages?: {
    readonly translations?: Readonly<Record<string, Readonly<Record<string, string>>>>
  }
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const stringAt = (
  owner: Readonly<Record<string, unknown>>,
  key: string,
  path: string
): ReadonlyArray<FoundAddress> => {
  const value = owner[key]
  return typeof value === 'string' ? [{ path: `${path}.${key}`, address: value }] : []
}

/**
 * The addresses an `onSuccess` / `onError` response names: `navigate`,
 * `redirect`, `buttonHref`, every `actions[].url`, and `url` on a redirect.
 */
const addressesOfResponse = (
  response: Readonly<Record<string, unknown>>,
  path: string
): ReadonlyArray<FoundAddress> => {
  const { actions } = response
  return [
    ...stringAt(response, 'navigate', path),
    ...stringAt(response, 'redirect', path),
    ...stringAt(response, 'buttonHref', path),
    ...(response['type'] === 'redirect' ? stringAt(response, 'url', path) : []),
    ...(Array.isArray(actions)
      ? actions.flatMap((action: unknown, index) =>
          isRecord(action) ? stringAt(action, 'url', `${path}.actions[${index}]`) : []
        )
      : []),
  ]
}

const addressesOwnedBy = (
  key: string,
  child: unknown,
  path: string
): ReadonlyArray<FoundAddress> => {
  if (!isRecord(child)) return []
  if (key === 'onSuccess' || key === 'onError') return addressesOfResponse(child, path)
  const { cta } = child
  if (key === 'closedPage' && isRecord(cta)) return stringAt(cta, 'href', `${path}.cta`)
  return []
}

/** Every form address in `value`, with the config path that carries it. */
const collectFormAddresses = (value: unknown, path: string): ReadonlyArray<FoundAddress> => {
  if (Array.isArray(value)) {
    return value.flatMap((item: unknown, index) => collectFormAddresses(item, `${path}[${index}]`))
  }
  if (!isRecord(value)) return []
  return Object.entries(value).flatMap(([key, child]) => {
    const childPath = path === '' ? key : `${path}.${key}`
    return [...addressesOwnedBy(key, child, childPath), ...collectFormAddresses(child, childPath)]
  })
}

/**
 * A `$t:` form address is held to the rule in every language: each
 * translation of its key must be an address a form may send its visitor to.
 * Returns the refusal for the first translation that is not, naming the key,
 * the language and the value; a key missing from some language is left to
 * the translation checks.
 */
export const validateTranslatedFormAddresses = (app: TranslatedAddressApp): string | undefined => {
  const translations = Object.entries(app.languages?.translations ?? {})
  if (translations.length === 0) return undefined
  const refusals = collectFormAddresses(app, '')
    .filter(({ address }) => address.startsWith('$t:'))
    .flatMap(({ path, address }) => {
      const key = address.slice(3)
      return translations.flatMap(([language, dictionary]) => {
        const translated = dictionary[key]
        return translated !== undefined && !isFormAddress(translated)
          ? [
              `${path}: the "${language}" translation of $t:${key} is not an address a form may send its visitor to. ${formAddressMessage(translated)}`,
            ]
          : []
      })
    })
  return refusals.at(0)
}
