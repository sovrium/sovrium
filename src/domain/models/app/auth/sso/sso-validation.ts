/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ADMIN_TIER_ROLE_NAMES, BUILT_IN_ROLES } from '../roles'

/**
 * The roles that open the admin plane. A sign-up default must never be one of
 * them, and neither may an SSO role mapping's fallback: only an explicit map
 * entry can hand one out.
 */
export const ADMIN_PLANE_ROLE_NAMES: readonly string[] = ['admin', ...ADMIN_TIER_ROLE_NAMES]

/** The built-in roles, plus the admin-tier names assignable at runtime. */
const ASSIGNABLE_RESERVED_ROLES: readonly string[] = [...BUILT_IN_ROLES, ...ADMIN_TIER_ROLE_NAMES]

/** The slice of one provider the per-provider rule reads. */
export interface SsoProviderForValidation {
  readonly id: string
  readonly type: 'oidc' | 'saml'
  readonly oidc?: unknown
  readonly saml?: {
    readonly metadata?: string
    readonly entityId?: string
    readonly entryPoint?: string
    readonly cert?: string
  }
}

/**
 * One provider: its protocol block matches its `type`, and a SAML provider is
 * described either by metadata or by the full entityId + entryPoint + cert
 * triple. Returns the refusal, or `undefined` when the provider is coherent.
 */
export const validateSsoProvider = (provider: SsoProviderForValidation): string | undefined => {
  const { id, type, oidc, saml } = provider
  if (type === 'oidc') {
    if (oidc === undefined) return `SSO provider '${id}' has type oidc but no oidc block`
    if (saml !== undefined)
      return `SSO provider '${id}' has type oidc and must not carry a saml block`
    return undefined
  }
  if (saml === undefined) return `SSO provider '${id}' has type saml but no saml block`
  if (oidc !== undefined)
    return `SSO provider '${id}' has type saml and must not carry an oidc block`
  if (saml.metadata !== undefined) return undefined
  const missing = (['entityId', 'entryPoint', 'cert'] as const).filter(
    (key) => saml[key] === undefined
  )
  return missing.length === 0
    ? undefined
    : `SSO provider '${id}' needs saml.metadata, or saml.entityId, saml.entryPoint and saml.cert (missing: ${missing.join(', ')})`
}

/** The slice of `auth` the enterprise-auth cross-rules read. */
export interface EnterpriseAuthForValidation {
  readonly roles?: readonly { readonly name: string }[]
  readonly sso?: readonly {
    readonly id: string
    readonly domains?: readonly string[]
    readonly roleMapping?: {
      readonly map: Readonly<Record<string, string>>
      readonly default?: string
    }
  }[]
  readonly scim?: { readonly providers?: readonly string[] }
}

const firstDuplicate = (values: readonly string[]): string | undefined =>
  values.find((value, index) => values.indexOf(value) !== index)

const validateUniqueProviderIds = (
  providers: NonNullable<EnterpriseAuthForValidation['sso']>
): string | undefined => {
  const duplicate = firstDuplicate(providers.map((provider) => provider.id))
  return duplicate === undefined ? undefined : `Duplicate SSO provider id '${duplicate}'`
}

const validateUniqueDomains = (
  providers: NonNullable<EnterpriseAuthForValidation['sso']>
): string | undefined => {
  const owners = providers.flatMap((provider) =>
    (provider.domains ?? []).map((domain) => ({ domain, id: provider.id }))
  )
  const clash = owners.find(
    (owner, index) => owners.findIndex((other) => other.domain === owner.domain) !== index
  )
  if (clash === undefined) return undefined
  const first = owners.find((owner) => owner.domain === clash.domain)
  return first?.id === clash.id
    ? `SSO provider '${clash.id}' lists domain '${clash.domain}' twice`
    : `Domain '${clash.domain}' is claimed by SSO providers '${first?.id ?? ''}' and '${clash.id}' — a domain routes to one provider`
}

const validateRoleMappings = (
  config: EnterpriseAuthForValidation,
  providers: NonNullable<EnterpriseAuthForValidation['sso']>
): string | undefined => {
  const known = new Set([...ASSIGNABLE_RESERVED_ROLES, ...(config.roles ?? []).map((r) => r.name)])
  const refusals = providers.flatMap((provider) => {
    const mapping = provider.roleMapping
    if (mapping === undefined) return []
    const unknown = Object.entries(mapping.map).find(([, role]) => !known.has(role))
    if (unknown !== undefined) {
      return [
        `SSO provider '${provider.id}' maps '${unknown[0]}' to role '${unknown[1]}', which is not a built-in role or declared in auth.roles`,
      ]
    }
    if (mapping.default === undefined) return []
    if (ADMIN_PLANE_ROLE_NAMES.includes(mapping.default)) {
      return [
        `SSO provider '${provider.id}' roleMapping.default is '${mapping.default}', an admin role — an admin role can only be granted by an explicit map entry`,
      ]
    }
    return known.has(mapping.default)
      ? []
      : [
          `SSO provider '${provider.id}' roleMapping.default '${mapping.default}' is not a built-in role or declared in auth.roles`,
        ]
  })
  return refusals[0]
}

const validateScimProviders = (config: EnterpriseAuthForValidation): string | undefined => {
  const listed = config.scim?.providers
  if (listed === undefined) return undefined
  const declared = new Set((config.sso ?? []).map((provider) => provider.id))
  const unknown = listed.find((id) => !declared.has(id))
  return unknown === undefined
    ? undefined
    : `auth.scim.providers names '${unknown}', which is not an auth.sso provider id`
}

/**
 * The cross-field rules of single sign-on and SCIM: provider ids are unique, a
 * domain routes to one provider, role mappings name roles that exist and never
 * fall back to an admin role, and SCIM links only to declared providers.
 */
export const validateEnterpriseAuth = (config: EnterpriseAuthForValidation): string | undefined => {
  const providers = config.sso ?? []
  return (
    validateUniqueProviderIds(providers) ??
    validateUniqueDomains(providers) ??
    validateRoleMappings(config, providers) ??
    validateScimProviders(config)
  )
}
