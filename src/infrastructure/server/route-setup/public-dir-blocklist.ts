/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The paths the public-directory route refuses to serve whatever the directory
 * holds.
 */

/**
 * Pattern matching the well-known secret / dev-artifact file shapes that must
 * never be served by the public-directory route, even if the operator
 * accidentally placed them under publicDir. Matched against the URL path
 * (case-insensitive). Returns 404 (NOT 403) on match — per S1 anti-enumeration,
 * an attacker probing for `.env.production` must NOT learn whether the file
 * exists from a 403-vs-404 distinction.
 *
 * Covered shapes (each as a separate alternation):
 *  - `.env` / `.env.local` / `.env.production` / `.env.<anything>` at any depth
 *  - `.git/**` (any git internals)
 *  - `node_modules/**` (package manager directory)
 *  - `.sovrium/**` (runtime data dir — SQLite db, lock file, local uploads)
 *  - `CLAUDE.md` (LLM operator instructions — may contain secrets / IPs)
 *  - `*.key` / `*.pem` (SSH / TLS private material)
 *  - `*.sql` / `*.sqlite` / `*.sqlite-journal` (database dumps + SQLite files)
 *
 * The leading group `(?:^|\/)` anchors each pattern to a path-segment boundary
 * so `legitimate-app.key.png` is NOT mistaken for a private key.
 */
export const PUBLIC_DIR_SECRET_BLOCKLIST =
  /(?:^|\/)(?:\.env(?:\..+)?|\.git\/.*|node_modules\/.*|\.sovrium\/.*|CLAUDE\.md|[^/]+\.(?:key|pem|sql|sqlite(?:-journal)?))$/i
