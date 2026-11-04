/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { redactSecretPath } from '@/domain/kernel/url/secret-path-redaction'

/**
 * The route template a request is logged as, when its concrete path carries a
 * credential no fixed pattern knows: a signing link's token sits in a path the
 * app declares. The route that recognises it marks the request; the access
 * log and the error log write the template instead of the path.
 */
const templates = new WeakMap<Request, string>()

/** Log `request` as `template` rather than its concrete path. */
export const logRequestPathAs = (request: Request, template: string): void => {
  templates.set(request, template)
}

/** The path `request` is logged as: its marked template, else `path` with known credentials redacted. */
export const loggedRequestPath = (request: Request, path: string): string =>
  templates.get(request) ?? redactSecretPath(path)
