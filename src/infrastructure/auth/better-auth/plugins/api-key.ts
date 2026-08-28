/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { apiKey } from '@better-auth/api-key'
import { APIError } from 'better-auth/api'
import { adminAc, userAc } from 'better-auth/plugins/admin/access'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import type { Auth } from '@/domain/models/app/auth'
import type { GenericEndpointContext } from '@better-auth/core'
import type { Statements } from 'better-auth/plugins/access'

/**
 * Derive the permission grant a newly-minted key carries, from the ROLE of the
 * user who minted it ([internal ref], D10).
 *
 * This is the whole of the D10 mechanism, and it is deliberately *configuration*
 * rather than a hand-rolled derivation in a wrapper route: the plugin accepts
 * `permissions.defaultPermissions` as a function, calls it with the resolved
 * `referenceId` AFTER its own ownership guard has run, and stores the result.
 * A caller-supplied `permissions` payload never reaches here — upstream's
 * `create-api-key.ts` refuses it with 400 (`SERVER_ONLY_PROPERTY`) on any
 * request carrying a `request` or `headers`, which is every request on the call
 * path Sovrium uses. So the grant is a pure function of who asked, not of what
 * they asked for.
 *
 * THE VOCABULARY IS BORROWED, NOT INVENTED. The two values are the vendored
 * `adminAc` / `userAc` statement sets — the same projection
 * `buildRolePermissions` (`plugins/admin.ts`) applies for the admin plane. An
 * admin-equivalent creator's key records the admin statements; everyone else's
 * records the empty user set. Inventing a third vocabulary here would mean two
 * places in `src/` disagreeing about what a role may do.
 *
 * HONEST LIMIT: nothing in Sovrium READS `apikey.permissions` today. The plugin
 * stores it and hands it back from `verifyApiKey`; no Sovrium authorization path
 * consults it. Recording it is what makes a future reader correct by default
 * instead of having to backfill every key ever minted — but a key does not
 * currently authorize any differently because of this column. The security
 * property that IS live is the negative one the spec pins: a caller cannot put
 * anything of their own choosing into it.
 */
const permissionsForRole = (roleName: string | null | undefined, authConfig?: Auth): Statements =>
  isAdminEquivalent(roleName ?? '', { auth: authConfig }) ? adminAc.statements : userAc.statements

/**
 * Reject a key whose OWNER is currently banned.
 *
 * THE DEFECT THIS CLOSES. The plugin's `before` hook authenticates a key by
 * FABRICATING `ctx.context.session` from the key row plus a `findUserById`
 * lookup — it never creates a session ROW. Better Auth's banned-user check is a
 * `session.create.before` DATABASE hook, so on this path it never runs, and the
 * hook's own guard throws only `if (!user)` — an assertion of EXISTENCE, not of
 * standing. `banUser` deletes session rows only. A banned user's key therefore
 * kept working with its pre-ban role, and since Sovrium passes no
 * `keyExpiration` its `expiresAt` is `null`, so it kept working indefinitely —
 * silently, while the admin console reported the account as banned.
 *
 * WHY THE CHECK IS READ LIVE HERE rather than cascaded on ban:
 *
 *  1. **No write-ordering window.** A cascade that writes `banned = true` and
 *     then deletes keys leaves a gap in which an in-flight request still
 *     succeeds. A check read at validation time has no such gap.
 *  2. **It covers every ban route by construction.** A cascade would have to be
 *     duplicated in the admin endpoint AND in `AuthRepository.banUser` — and
 *     duplication across routes is the exact mechanism that produced this
 *     defect. This hook is the single gate every keyed request passes through,
 *     whichever Sovrium route ultimately consumes the session.
 *  3. **A ban is reversible.** Better Auth auto-clears one on `banExpires`.
 *     Destroyed keys could never be restored; a suspended one simply resumes.
 *
 * So a ban SUSPENDS the credential — the `auth.api_key` row survives untouched
 * and an unban restores it.
 *
 * WHY IT IS A WRAPPER AND NOT A LINE IN THE HOOK. The `if (!user)` throw lives
 * in vendor code (`@better-auth/api-key`), which `src/` cannot edit. Nor can the
 * check live in a plugin registered after this one: for `ctx.path ===
 * '/get-session'` — which is precisely the path `auth.api.getSession()` takes,
 * and therefore every `x-api-key` request to a Sovrium route — the vendor hook
 * RETURNS the session, and `runBeforeHooks` short-circuits on any return lacking
 * a `context` key, so no later hook runs. Decorating this hook is the only seam
 * that sees every keyed request. `createInternalContext` passes `context.context`
 * through by reference, so the session the vendor just fabricated is readable
 * here the moment its handler resolves.
 *
 * `=== true` is deliberate: the column is nullable, and `banned = NULL` means
 * "never banned", exactly as `unbanUser`'s explicit `banned = false` does.
 *
 * 401, matching the anonymous caller (-003) and the revoked key (-004): the
 * credential fails to AUTHENTICATE, so the request is indistinguishable from a
 * credential-less one. The 404 anti-enumeration rule governs object-level
 * authorization, which is a different question. `authMiddleware` catches this
 * throw, leaves `c.var.session` unset, and `requireAuthHandler` answers 401.
 */
type ApiKeyPlugin = ReturnType<typeof apiKey>
type BeforeHook = ApiKeyPlugin['hooks']['before'][number]
type HookInput = Parameters<BeforeHook['handler']>[0]

// eslint-disable-next-line functional/prefer-immutable-types -- the vendor's own hook type; a `Readonly<>` wrapper would not match the shape the plugin is registered and called with
const rejectBannedOwner = (hook: BeforeHook): BeforeHook => ({
  ...hook,
  // eslint-disable-next-line functional/prefer-immutable-types -- same: `HookInput` is `better-call`'s own `MiddlewareInputContext`
  handler: (async (input: HookInput) => {
    const result = await hook.handler(input)
    const owner = (
      input as { readonly context?: { readonly session?: { readonly user?: unknown } } }
    ).context?.session?.user

    if ((owner as { readonly banned?: unknown } | undefined)?.banned === true) {
      // eslint-disable-next-line functional/no-throw-statements -- throwing an `APIError` IS Better Auth's hook-rejection protocol; the dispatcher maps it to the HTTP status, exactly as `admin-role-guards.ts` does
      throw new APIError('UNAUTHORIZED', { message: 'User is banned' })
    }

    return result
  }) as BeforeHook['handler'],
})

/**
 * Build the self-service API-key plugin when `auth.apiKeys` is enabled.
 *
 * Gated exactly like `twoFactor` / `magicLink` / `emailOTP`: absent opt-in means
 * the plugin is not in the array at all, so `/api/auth/api-key/*` answers 404
 * rather than 401 — the surface does not acknowledge its own existence
 *.
 *
 * Three options, and each one is load-bearing:
 *
 *  - **`enableSessionForAPIKeys: true`** is what makes a key AUTHENTICATE.
 *    Without it the plugin's `before` hook never matches: `findApiKeyAndConfig`
 *    opens with `if (!config.enableSessionForAPIKeys) continue`, so an
 *    `x-api-key` header is simply ignored and every keyed request 401s. Upstream
 *    labels the option "not recommended for production" because it mints a
 *    session for a long-lived credential — which is precisely the feature here,
 *    and the reason the credential is hashed at rest, revocable, and scoped to
 *    its creator.
 *  - **`apiKeyHeaders: 'x-api-key'`** (the default, pinned explicitly) keeps the
 *    credential OFF `Authorization: Bearer`. `authMiddleware`'s `Bearer ` branch
 *    rebuilds a Headers containing only `authorization`, discarding the cookie
 *    and any `x-api-key`; it resolves nothing today and must stay that way
 *    rather than becoming a second, unaudited credential path
 *.
 *  - **`permissions.defaultPermissions`** as a FUNCTION — see
 *    {@link permissionsForRole}.
 *  - **`rateLimit: { enabled: false }`** turns OFF a limiter that is on by
 *    default and would otherwise cap EVERY key at **10 requests per 24 hours**
 *    (`apiKey`'s own defaults: `maxRequests: 10`, `timeWindow: 24h`). Nothing
 *    in Sovrium ever set it, so that cap was silently in force on every key
 *    ever issued. It is wrong on both surfaces: on `/api/*` a key has no
 *    documented budget at all, and on `/mcp` there IS one —
 *    `MCP_RATE_LIMIT_PER_MINUTE` / `_PER_DAY`, default 60/min and 5000/day —
 *    which a hidden 10/day silently overrides three orders of magnitude below
 *    what the operator configured. A second limiter that is undocumented,
 *    unconfigurable and answers with a bare 401 rather than a 429 is not a
 *    safety net; it is a failure nobody can diagnose. Sovrium keeps ONE
 *    rate-limit story per surface, and it is Sovrium's own.
 *
 * `references` is left at its default (`'user'`), so `referenceId` is always an
 * `auth.user.id`. That is the assumption the `auth.api_key.reference_id` foreign
 * key encodes, and the reason there is no admin-manages-others path to write.
 *
 * WHAT IS RETURNED IS NOT THE BARE VENDOR PLUGIN. Its `before` hooks are wrapped
 * by {@link rejectBannedOwner}, which is what stops a banned owner's key from
 * authenticating. Options alone cannot express that check — see that function's
 * note for why the seam has to be here.
 */
export const buildApiKeyPlugin = (authConfig?: Auth) => {
  if (!authConfig?.apiKeys) return []

  const plugin = apiKey({
    apiKeyHeaders: 'x-api-key',
    enableSessionForAPIKeys: true,
    rateLimit: { enabled: false },
    permissions: {
      // eslint-disable-next-line functional/prefer-immutable-types -- `GenericEndpointContext` is the vendor's own callback parameter type; a `Readonly<>` wrapper here would not match the signature the plugin calls this with
      defaultPermissions: async (referenceId: string, ctx: GenericEndpointContext) => {
        const user = await ctx.context.internalAdapter.findUserById(referenceId)
        return permissionsForRole((user as { role?: string } | null)?.role, authConfig)
      },
    },
  })

  return [
    {
      ...plugin,
      hooks: { ...plugin.hooks, before: plugin.hooks.before.map(rejectBannedOwner) },
    },
  ]
}
