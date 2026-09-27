/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The widest page any list endpoint will serve.
 *
 * One number read in three places, which is why it lives in the kernel rather
 * than beside any one of them:
 *
 *   - the records API refuses a `?limit=` above it with a 400 rather than
 *     clamping, and caps the response's own `pagination.limit` at it;
 *   - a page component's `pageSize` and `pageSizeOptions` are refused above it
 *     at validate time, because a page size the author wrote is a request the
 *     grid will send, and one above this ceiling fails the moment a reader
 *     picks it;
 *   - the browser-side pager asks for pages of at most this many rows.
 *
 * A dependency-free constant, so a client island can import it without pulling
 * Effect Schema into its chunk.
 */
export const MAX_PAGE_SIZE = 100
