/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHash, randomBytes } from 'node:crypto'

/**
 * The private token behind a form's resume link and edit link.
 *
 * 32 random bytes, written base64url (43 characters) so it rides a path
 * segment or a query parameter untouched. Only its SHA-256 is stored: the
 * token itself exists in the link the submitter holds and nowhere else, so
 * reading the database cannot reopen anyone's answers.
 */
export interface IssuedAccessToken {
  readonly token: string
  readonly hash: string
}

/** The digest a token is stored and looked up under. */
export const hashAccessToken = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex')

/** A fresh token and the digest to store in its place. */
export const issueAccessToken = (): IssuedAccessToken => {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashAccessToken(token) }
}
