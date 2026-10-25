# Launch review template

Fill one section per letter, in order. Each line is answered from evidence (a request and its answer, a banner line, a config line), never from memory. Grade each section: **Pass** (every line holds), **Fix before launch** (a Critical or High finding is open), **Accepted** (a finding the owner accepted, with their reason written down).

```
# Launch review — <app name>, <public origin>, <date>
Reviewed against: <the instance you ran and its version (sovrium --version)>
Accounts used: anonymous, <role A>, <role B>, admin

## A. Origin and transport                       Grade:
- BASE_URL is the public https origin:          <value>
- Set-Cookie on sign-in carries Secure:         <yes/no>
- Forged Origin on a cookie POST is refused:    <status>
- No ⚠ line about BASE_URL, SOVRIUM_ALLOW_INSECURE or dev mode in the banner: <banner excerpt>
- SOVRIUM_DEV_MODE is unset; the sign-in page shows no credentials: <yes/no>
- TRUSTED_PROXY_HOPS matches the proxies in front: <value, proxies>

## B. Accounts                                   Grade:
- allowSignUp matches the audience:             <value, audience>
- Open sign-up banner line agreed or absent:    <excerpt>
- requireEmailVerification (open sign-up) and SMTP on the target: <values>
- minPasswordLength:                            <value>
- Admin second factor or requireForAdmin:       <value>
- SSO providers, their domains and allowSignUp: <list>

## C. Access to data                             Grade:
- Every table has a permissions block:          <tables without one>
- As role A, another person's record:           <status>
- As role A, a hidden field and a filter on it: <result>
- Every bucket declares upload and download:    <buckets without them>
- Another person's file, as role A:             <status>

## D. Public writes                              Grade:
- Public forms, each intended:                  <list>
- antiSpam left at its defaults or tightened:   <list>
- Tables with create: all, each intended:       <list>
- Signing grants set to all:                    <list>
- Inbound webhooks authenticated:               <list>

## E. Secrets                                    Grade:
- No credential inline in the config tree:      <grep result>
- .env not committed:                           <git ls-files result>
- Encryption key backed up apart from the data: <where>
- Backups encrypted:                            <how>

## F. Privacy and AI                             Grade:
- Export and erasure tried with a test account: <results>
- created-by on tables holding people's own data: <tables without it>
- Retention: log-like tables, chats, logs:      <values>
- AI_CHAT_RATE_LIMIT set:                       <value>
- Agents: role, trigger, approval on irreversible actions: <per agent>
- MCP_ENABLED, aiAccess tables, MCP_EXPOSE_INTERNALS: <values>

## Findings (from the report template in SKILL.md, highest first)

## Dropped after triage (one line each, with the reason)

Decisions to record: <title — touches>   (one line per nominated decision, or: Decisions to record: none)
```

Nominate only a choice a future operator would ask about (the data-model shape, the permissions or auth model, SQLite or PostgreSQL, a design character, a disabled automation, a security trade-off left in place such as dev mode on a public origin or an open table), never labels, copy or colours. Skills only nominate; only the `sovrium-config-editor` agent writes the `decisions:` register. A security trade-off the owner accepts (Accepted above) is always nominated.

A section with nothing to check (no `auth`, no buckets, no AI) is written as "not applicable", with the reason, rather than left out.
