/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Request paths one of whose segments IS a credential, and the template each is
 * written as wherever a path is recorded (the access log, the error log, an
 * exception report): a calendar feed address authorises its reader by the
 * token in its path, so the concrete path is as secret as a password.
 *
 * Matched loosely on purpose — in any letter case, with the extension
 * percent-encoded, and without it — because a mistyped address that never
 * reaches the feed route is logged too, with the token still in it. Only the
 * literal `token` segment, the address-management route, is left as written.
 */
const CALENDAR_FEED_SEGMENT =
  /(\/api\/tables\/[^\s/?#]+\/calendar-feed\/)(?!token(?=[\s/?#]|$))([^\s/?#]+)/gi

/** A segment ending in `.ics`, its dot written or percent-encoded. */
const ICS_EXTENSION = /(?:\.|%2e)ics$/i

/** `path` (or a whole URL) with every credential segment replaced by its template. */
export const redactSecretPath = (path: string): string =>
  path.replace(
    CALENDAR_FEED_SEGMENT,
    (_match, prefix: string, segment: string) =>
      `${prefix}${ICS_EXTENSION.test(segment) ? ':token.ics' : ':token'}`
  )
