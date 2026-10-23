/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The pause a search box declaring no `debounceMs` waits for before its term
 * reaches its subscribers: long enough that a typed word costs one read, short
 * enough that the reader does not notice it. Its own module so that a
 * subscriber reading it ships the number alone, not the publisher.
 */
export const DEFAULT_SEARCH_DEBOUNCE_MS = 250
