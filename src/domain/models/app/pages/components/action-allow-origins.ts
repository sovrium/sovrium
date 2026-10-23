/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `onSuccess.allowOrigins` — the other sites an action may send the reader to,
 * when the address is one its run returned.
 *
 * An answered action moves the reader within the app: `onSuccess.navigate`
 * written as an `http://` or `https://` address is refused when the config is
 * read, and an address filled from the run (`$response.url`) is checked again
 * when it is followed. A payment checkout is the case that rule cannot serve —
 * the provider answers with the address of ITS page, and the reader must go
 * there.
 *
 * So one action, and only that action, may name the exact origins it trusts.
 * The list is read only when `navigate` is a lone `$response.<path>` reference
 * to the run's answer; beside any other `navigate` it would validate and do
 * nothing, so it is refused. At run time the returned address is parsed and its
 * origin compared exactly with the list: a match sends the whole page there;
 * another origin, a script address or a malformed value is refused, the reader
 * stays, and the action's `onError` is shown.
 *
 * Exact origins only — scheme, host and optional port, no path and no wildcard
 * — so `https://checkout.example.com.attacker.example` never matches
 * `https://checkout.example.com`. `https://` only, except `http://localhost`
 * (any port), which is accepted outside production for local testing and
 * refused in production like any other `http://` origin.
 */

import { Schema } from 'effect'
import {
  FORM_ADDRESS_PATTERN,
  formAddressMessage,
  isFormAddress,
} from '../../forms/form-address-validation'

/** One exact origin: `https://host[:port]`, or `http://localhost[:port]`. */
const ORIGIN_PATTERN =
  /^(?:https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*|http:\/\/localhost)(?::\d{1,5})?$/

/** A `navigate` that is exactly one `$response.<path>` reference and nothing else. */
const LONE_RESPONSE_REFERENCE = /^\$response(?:\.[A-Za-z_][A-Za-z0-9_]*)+$/

export const AllowOriginsSchema = Schema.Array(
  Schema.String.pipe(
    Schema.annotate({
      description:
        'One exact origin: https:// and a host, with an optional port, no path and no wildcard. http://localhost (any port) is accepted outside production only.',
      examples: ['https://checkout.stripe.com', 'http://localhost:4242'],
    }),
    Schema.check(
      Schema.isPattern(ORIGIN_PATTERN, {
        message:
          'an allowed origin is https:// and a host with an optional port — no path, no wildcard, no trailing slash — or http://localhost for local testing',
      })
    )
  )
).pipe(
  Schema.annotate({
    title: 'Allowed Origins',
    description:
      'Other sites this action may send the reader to, as exact origins (https://host or https://host:port), read only when navigate is a lone $response.<path> reference to the address the run returned. A returned address on a listed origin opens in the whole page; any other address is refused, the reader stays, and onError is shown. A literal http:// or https:// navigate stays refused whatever this list says. http://localhost is accepted outside production only.',
    examples: [['https://checkout.stripe.com']],
  }),
  Schema.check(Schema.isMinLength(1))
)

/**
 * Why an `allowOrigins` list is refused where it sits, or `true` when it is
 * read: it is read only beside a `navigate` that is a lone `$response.<path>`.
 */
export const allowOriginsNavigateConflict = (response: {
  readonly allowOrigins?: ReadonlyArray<string> | undefined
  readonly navigate?: string | undefined
}): true | string => {
  if (response.allowOrigins === undefined) return true
  if (response.navigate !== undefined && LONE_RESPONSE_REFERENCE.test(response.navigate)) {
    return true
  }
  return "onSuccess declares 'allowOrigins' without a navigate that is a lone $response.<path> reference — the list is read only for an address the run returned (navigate: $response.url), so here it would allow nothing. Point navigate at the run's answer, or drop allowOrigins."
}

/**
 * The check an `onSuccess.navigate` takes: an address a form may send its
 * visitor to, or a lone `$response.<path>` reference to the address the run
 * returned. The second is judged when it is followed — an address on this
 * site, or one on an origin `allowOrigins` lists — since nothing can see the
 * run's answer when the config is read.
 */
export const successNavigateCheck = Schema.makeFilter<string>(
  (address) =>
    LONE_RESPONSE_REFERENCE.test(address) || isFormAddress(address) || formAddressMessage(address),
  {
    toJsonSchema: () => ({
      pattern: `${LONE_RESPONSE_REFERENCE.source}|${FORM_ADDRESS_PATTERN.source}`,
    }),
  }
)
