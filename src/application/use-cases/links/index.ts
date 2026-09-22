/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The links surface — reading the catalog, resolving a state, and mutating a
 * link — for every caller outside this folder.
 *
 * Import from here rather than reaching into the modules: the split between
 * the catalog projection, state derivation, the read programs, the overlay
 * writer and the mutation programs is an internal arrangement, and a caller
 * that depends on it is a caller that breaks when it changes. That was not
 * hypothetical — the links console imported four of the five modules by path.
 */

export {
  buildCatalog,
  configEntry,
  dbEntry,
  primaryDestination,
  toIsoOrNull,
  type CatalogEntry,
  type CatalogState,
  type UtmView,
} from './catalog'
export { configSlugs, declaredLink } from './config-slugs'
export {
  LinkMutationConflictError,
  LinkValueRejectedError,
  type LinkMutationConflictCode,
} from './errors'
export {
  createLink,
  deleteLink,
  updateLink,
  type CreateLinkCommand,
  type DeleteLinkResult,
  type UpdateLinkCommand,
} from './mutate-link'
export { countLinkClicks, resolveEntryState } from './link-state'
export {
  listLinkCatalog,
  readLinkEntry,
  resolveLinkEntry,
  type LinkCatalogPage,
  type LinkCatalogQuery,
  type StatedLinkEntry,
} from './read-link-catalog'
export {
  configLinkRefusesOverlay,
  setLinkOverlay,
  type LinkOverlayResult,
} from './set-link-overlay'
export {
  mergeUtmPatch,
  utmPatchFromFlat,
  utmRecordFromFlat,
  UTM_FIELDS,
  type LinkUtmPatch,
  type UtmKey,
} from './utm'
