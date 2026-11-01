/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Context } from 'hono'

/*
 * Hono's middleware contract replaces the response by ASSIGNING `c.res`, and
 * its setter has one subtlety every caller must choose about: assigning over a
 * response that is already set copies the old response's headers (all but
 * `content-type`, with every `Set-Cookie` re-appended) onto the new one. These
 * two helpers name the two choices and are the one place that assigns `c.res`.
 */
/* eslint-disable no-param-reassign -- Hono's middleware contract replaces the response by assigning `c.res`; this module is the one place that does it */

/**
 * Answer with exactly `res`: the old response is cleared first, so none of its
 * headers (a dropped `Set-Cookie`, a stale `Content-Length`) is copied back.
 */
export const replaceResponse = (c: Context, res: Response): void => {
  c.res = undefined
  c.res = res
}

/**
 * Answer with `res` under Hono's own merge: the old response's headers are
 * copied onto it, as a bare `c.res = res` does.
 */
export const layerResponse = (c: Context, res: Response): void => {
  c.res = res
}

/* eslint-enable no-param-reassign -- end of the one assignment site */
