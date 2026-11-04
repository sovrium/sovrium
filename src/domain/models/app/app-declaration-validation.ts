/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { validateAllAdminMountRules } from './admin/admin-mount-validation'
import { validateAllKnowledgeReferences } from './agents/knowledge-validation'
import { validateAllAuthActionReferences } from './auth/roles/invite-role-validation'
import { validateAllCalendarImports } from './automations/actions/calendar/import-ics-validation'
import { validateNotificationKinds } from './automations/actions/notification/notification-kind-validation'
import { validateComponentPlacements } from './component-placement-validation'
import { validateConsentReferences } from './consent/consent-validation'
import { validateAllDesignReferences } from './design/design-validation'
import { validateAllEnvReferences } from './env-reference-validation'
import { validateAllShareRules } from './forms/share-validation'
import { validateAllLinkRules } from './links/links-validation'
import { validateAllQrCodePayloads } from './links/qr-code-validation'
import { validateAllComboboxChips } from './pages/combobox-chips-validation'
import { validatePageAddresses } from './pages/localized-path-validation'
import { validateAllPageAccessGroups } from './pages/page-access-validation'
import { validateAllSelectEmptyOptions } from './pages/select-empty-option-validation'
import { validateAllNativeSelects } from './pages/select-native-validation'
import { validateAllSelectOptionSources } from './pages/select-option-source-validation'
import { validateAllSystemSourceReferences } from './pages/system-source-validation'
import { validateAllSignatureFlows } from './signatures/signatures-validation'
import { validateDateTimeFormats } from './tables/fields/field-types/date-time/datetime-format-validation'
import { validateReadStateCountNames } from './tables/read-state-validation'
import { validateAllTablePermissionGroups } from './tables/table-permission-groups-validation'
import { validateTranslatableContent } from './tables/translatable-validation'

/**
 * The closing `AppSchema` filter: every declaration a page, a form, a component
 * or an agent makes resolves against what the app declares — agent table
 * knowledge, page access groups, system-source names, page addresses and
 * redirects, the reserved `/l`, `/s` and `/_admin` namespaces, select
 * declarations, design references, QR payloads, component placements, then
 * permission groups, `auth` operator roles, calendar imports, notification
 * kinds, read-state counts, translatable fields and every `$env.NAME`.
 *
 * One function because it is one filter: every extra filter in the `AppSchema`
 * chain pushes TypeScript's instantiation depth toward the limit at which the
 * derived `App` type collapses to `never`. The first refusal wins, in the order
 * below, with the same messages the inline filter printed.
 */

/**
 * The reserved-namespace family, as one check.
 *
 * `/l` (short links), `/s` (design-system shares) and the `/_admin` operator
 * console are matched BEFORE pages, forms and redirects alike. A route declared
 * inside any of them is therefore permanently unreachable, with nothing in the
 * config or the logs saying why — one failure mode, three namespaces, so one
 * function rather than three branches in a filter that is already at its
 * complexity budget.
 */
const validateReservedNamespaces = (
  app: Parameters<typeof validateAllLinkRules>[0]
): true | string => {
  const linkError = validateAllLinkRules(app)
  if (linkError !== true) return linkError
  const shareError = validateAllShareRules(app)
  if (shareError !== true) return shareError
  return validateAllAdminMountRules(app)
}

/**
 * `select` declaration cross-validation, grouped.
 *
 * Four independent rules over the same component: its option list may not be
 * answered twice (`options` vs `dataSource`, and the bound table's fields must
 * exist); a `native: true` control may not carry keys the browser's own select
 * cannot honour (`searchable`, `allowCustomValue`, a per-option `icon`); an
 * `emptyOption` may not sit on a `multiple` control or beside a static option
 * that already submits the empty string; and `multiple` may not sit beside
 * `searchable`, which names a control with nowhere to show a set.
 *
 * One helper rather than four branches for the same reason
 * {@link validateReservedNamespaces} is one: the final filter is AT its
 * complexity budget, and a tenth branch there fails the lint gate outright —
 * measured, not assumed.
 */
const validateSelectDeclarations = (
  app: Parameters<typeof validateAllSelectOptionSources>[0] &
    Parameters<typeof validateAllNativeSelects>[0] &
    Parameters<typeof validateAllSelectEmptyOptions>[0] &
    Parameters<typeof validateAllComboboxChips>[0]
): true | string => {
  const optionSourceError = validateAllSelectOptionSources(app)
  if (optionSourceError !== true) return optionSourceError
  const nativeError = validateAllNativeSelects(app)
  if (nativeError !== true) return nativeError
  const emptyOptionError = validateAllSelectEmptyOptions(app)
  if (emptyOptionError !== true) return emptyOptionError
  return validateAllComboboxChips(app)
}

/**
 * The declaration checks closing the final filter, as one branch: table permission groups, the
 * groups and roles `auth` operators name, the table a `calendar/importIcs` step writes, notification
 * kinds, read-state counts, translatable fields against `languages`, consent purpose references,
 * signing flows (their table, fields, page and connection, and the forms, triggers and steps that
 * name one), a `datetime` field's `format` pattern, then every `$env.NAME`.
 * Grouped for the complexity-budget reason of {@link validateSelectDeclarations}.
 */
const validateDeclaredReferences = (
  app: Parameters<typeof validateAllTablePermissionGroups>[0] &
    Parameters<typeof validateAllAuthActionReferences>[0] &
    Parameters<typeof validateAllEnvReferences>[0] &
    Parameters<typeof validateAllCalendarImports>[0] &
    Parameters<typeof validateNotificationKinds>[0] &
    Parameters<typeof validateTranslatableContent>[0] &
    Parameters<typeof validateConsentReferences>[0] &
    Parameters<typeof validateAllSignatureFlows>[0]
): true | string => {
  const permissionGroupError = validateAllTablePermissionGroups(app)
  if (permissionGroupError !== true) return permissionGroupError
  const authActionError = validateAllAuthActionReferences(app)
  if (authActionError !== true) return authActionError
  // The table a `calendar/importIcs` step writes into, and the fields it maps.
  const calendarImportError = validateAllCalendarImports(app)
  if (calendarImportError !== true) return calendarImportError
  const socialError = [
    validateNotificationKinds(app),
    validateReadStateCountNames(app),
    validateTranslatableContent(app),
    validateConsentReferences(app),
    validateAllSignatureFlows(app),
    validateDateTimeFormats(app),
  ]
  return socialError.find((verdict) => verdict !== true) ?? validateAllEnvReferences(app)
}

/**
 * Every declaration resolves; the first refusal, in the order of the module header.
 *
 * Pure; `AppSchema` runs it as one of its `Schema.check` filters, so its
 * message is the decode error a refused config prints.
 */
export const validateAppDeclarations = (
  app: Parameters<typeof validateAllKnowledgeReferences>[0] &
    Parameters<typeof validateAllPageAccessGroups>[0] &
    Parameters<typeof validateAllSystemSourceReferences>[0] &
    Parameters<typeof validatePageAddresses>[0] &
    Parameters<typeof validateReservedNamespaces>[0] &
    Parameters<typeof validateSelectDeclarations>[0] &
    Parameters<typeof validateAllDesignReferences>[0] &
    Parameters<typeof validateAllQrCodePayloads>[0] &
    Parameters<typeof validateComponentPlacements>[0] &
    Parameters<typeof validateDeclaredReferences>[0]
): true | string => {
  const knowledgeError = validateAllKnowledgeReferences(app)
  if (knowledgeError !== true) return knowledgeError
  const pageAccessError = validateAllPageAccessGroups(app)
  if (pageAccessError !== true) return pageAccessError
  // System-source reference cross-validation (CAP-4): every
  // `dataSource: { systemSource: <name> }` must resolve to a declared
  // `app.systemSources[]` entry — the offline `sovrium validate` win.
  const systemSourceError = validateAllSystemSourceReferences(app)
  if (systemSourceError !== true) return systemSourceError
  // Page addresses: per-language paths claim declared languages and distinct
  // addresses, and no `redirects[].from` shadows a static page path (it is
  // evaluated first). Bundled here (not a new `Schema.filter`) for the
  // deep-instantiation reason documented above.
  const redirectError = validatePageAddresses(app)
  if (redirectError !== true) return redirectError
  // Link-namespace cross-validation: no page, form or redirect may claim a
  // path under a RESERVED NAMESPACE — `/l` short links, `/s` design-system
  // shares, or the `/_admin` operator console. All three are matched before
  // pages, forms and redirects alike, so a route inside one is permanently
  // unreachable with nothing in the config saying why. Grouped into one
  // helper because they are one rule with three namespaces, and because
  // each extra branch in this filter counts against its complexity budget.
  const namespaceError = validateReservedNamespaces(app)
  if (namespaceError !== true) return namespaceError
  // Select declaration cross-validation: `options` and `dataSource` are
  // mutually exclusive, `dataSource.{table,displayField,valueField}` must
  // name a declared table and real fields on it, and a `native: true`
  // control may not carry keys the browser's own select cannot honour. One
  // branch, because this filter is at its complexity budget — see
  // `validateSelectDeclarations`. Bundled here (not a new `Schema.filter`)
  // for the deep-instantiation reason documented above.
  const selectError = validateSelectDeclarations(app)
  if (selectError !== true) return selectError
  // Design cross-validation: every `design.colorRoles` key names a declared colour token or
  // declares its own value, every ramp reference resolves, every `density.byZone` key names
  // a zone. Bundled here for the deep-instantiation reason documented above.
  const designError = validateAllDesignReferences(app)
  if (designError !== true) return designError
  // QR payload cross-validation: a `qr-code` component encodes exactly one of `link` or
  // `value`, which no field-level rule can state. Bundled here for the reason above.
  const qrCodeError = validateAllQrCodePayloads(app)
  if (qrCodeError !== true) return qrCodeError
  // Design-console cross-validation: a plotted easing token must name a curve the app can
  // resolve (one of the inherited four, a `design.motion.easings` key, or a written-out
  // `cubic-bezier(...)`); a name resolving to nothing draws an empty box read as "linear".
  // Component-template placement: a bare `$ref` names a template in `app.components`, refused
  // here rather than drawn as a request-time "not found" box. Grouped in
  // `validateComponentPlacements` for the complexity budget and deep-instantiation reasons.
  const componentError = validateComponentPlacements(app)
  if (componentError !== true) return componentError
  // Declarations (permission groups, `$env`, notification kinds, read-state counts): one
  // branch, for the complexity budget — see `validateDeclaredReferences`.
  return validateDeclaredReferences(app)
}
