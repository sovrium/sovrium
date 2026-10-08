/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { serializeJsonForScript } from '@/domain/kernel/sanitize/json-script-serialization'
import type { Context } from 'hono'

/**
 * Answer a webhook caller with a JSON body in which `<`, `>` and `&` are
 * written as `<`, `>` and `&`.
 *
 * The body of a `webhook/response` action or a `trigger.response` can carry
 * text from the request, and the operator may declare any `Content-Type` for
 * it, `text/html` included. A JSON parser reads the escaped value back
 * exactly; a browser opening the URL never finds markup the request put
 * there. `Content-Type` defaults to `application/json`, as `c.json` does, and
 * a declared one wins.
 */
export const webhookJson = (
  c: Context,
  body: unknown,
  status: number,
  headers: Readonly<Record<string, string>> = {}
): Response =>
  c.body(serializeJsonForScript(body), status as 200, {
    'Content-Type': 'application/json',
    ...headers,
  })
