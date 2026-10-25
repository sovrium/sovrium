# Sources

## Contents

- Application security (S1–S5)
- GDPR (S6–S11)
- Browser and HTTP standards (S12–S15, S20)
- Authentication (S16–S17)
- CSRF and MCP (S18–S19)
- Skills this one learned from (S21–S23)
- Sovrium

Each entry: title — organisation or author — URL — what was lifted. Every URL was fetched on 2026-10-24, except where marked. "Lifted" is a paraphrase; nothing is copied, and each source keeps its own licence. What Sovrium does comes from the manual of the binary you run, never from these.

## Application security (S1–S5)

- **S1 OWASP API Security Top 10 (2023)** — OWASP Foundation — https://owasp.org/API-Security/editions/2023/en/0x11-t10/ . Lifted: broken object-level and function-level authorisation, unrestricted resource consumption and security misconfiguration as the risks a config-built API inherits; authorise at the data, not the page.
- **S2 Application Security Verification Standard 5.0** — OWASP Foundation — https://owasp.org/www-project-application-security-verification-standard/ . Lifted: no default or demonstration credentials in production; multi-factor for privileged accounts; stay on supported versions.
- **S3 OWASP Top 10 (2025)** — OWASP Foundation — https://owasp.org/Top10/ . Lifted: access control and misconfiguration lead the list; deny by default.
- **S4 OWASP Top 10 for LLM Applications** — OWASP GenAI Security Project — https://genai.owasp.org/llm-top-10/ (the site refuses scripted fetches; read through search). Lifted: excessive agency, unbounded consumption, sensitive information disclosure; cap requests and tokens per user.
- **S5 OWASP Agentic Security Initiative** — OWASP GenAI Security Project — https://genai.owasp.org/initiatives/agentic-security-initiative/ (read through search). Lifted: identity and privilege abuse through delegated trust; an agent's credential scoped to its task, never the caller's full reach.

## GDPR (S6–S11)

- **S6 GDPR Article 15, right of access** — https://gdpr-info.eu/art-15-gdpr/ . Lifted: the data subject obtains a copy of her personal data.
- **S7 GDPR Article 17, right to erasure** — https://gdpr-info.eu/art-17-gdpr/ . Lifted: erasure without undue delay; the exceptions that justify keeping an accountability record.
- **S8 GDPR Article 20, right to data portability** — https://gdpr-info.eu/art-20-gdpr/ . Lifted: a structured, machine-readable format.
- **S9 GDPR Article 5, principles** — https://gdpr-info.eu/art-5-gdpr/ . Lifted: data minimisation and storage limitation, the basis for retention windows and analytics opt-outs.
- **S10 GDPR Article 32, security of processing** — https://gdpr-info.eu/art-32-gdpr/ . Lifted: confidentiality of processing systems; the ability to restore data, the basis for keys and encrypted backups.
- **S11 GDPR Article 30, records of processing** — https://gdpr-info.eu/art-30-gdpr/ . Lifted: the time limits for erasure belong in the record of processing.

## Browser and HTTP standards (S12–S15, S20)

- **S12 Strict-Transport-Security** — MDN — https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security . Lifted: browsers ignore the header over plain HTTP.
- **S13 Set-Cookie, the Secure attribute** — MDN — https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie . Lifted: a cookie without `Secure` is sent over plain HTTP.
- **S14 CSP frame-ancestors** — MDN — https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors . Lifted: list exact origins allowed to frame a page; a report-only policy does not enforce it.
- **S15 SameSite cookies explained** — web.dev — https://web.dev/articles/samesite-cookies-explained . Lifted: why a cross-site request can still carry a session cookie.
- **S20 RFC 9110, HTTP Semantics** — IETF — https://www.rfc-editor.org/rfc/rfc9110 . Lifted: a server may answer 404 instead of 403 to hide that a resource exists.

## Authentication (S16–S17)

- **S16 Authentication Cheat Sheet** — OWASP — https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html . Lifted: verify email on open registration; protect against automated attacks; strong factors for administrators.
- **S17 NIST SP 800-63B, Authentication and Lifecycle Management** — NIST — https://pages.nist.gov/800-63-4/sp800-63b.html . Lifted: length over composition rules; no forced periodic rotation.

## CSRF and MCP (S18–S19)

- **S18 Cross-Site Request Forgery Prevention Cheat Sheet** — OWASP — https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html . Lifted: verify the `Origin` of state-changing requests.
- **S19 MCP security best practices** — Model Context Protocol — https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices . Lifted: authenticate every caller; a token names a user; least privilege for exposed tools.

## Skills this one learned from (S21–S23)

- **S21 Skill authoring best practices** — Anthropic — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices . Lifted: a description that says what and when, a copyable checklist, a validate-fix loop, one level of references.
- **S22 Equipping agents for the real world with Agent Skills** — Anthropic engineering — https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills . Lifted: progressive disclosure; references read only when needed.
- **S23 claude-code-owasp, the `owasp-security` skill** — agamm — https://github.com/agamm/claude-code-owasp . Lifted: map entry points and trust boundaries before sweeping; a four-question triage before a finding is reported; a severity-first report with a confidence level; an empty report said plainly.

## Sovrium

- **The Sovrium manual**, shipped in the binary: `sovrium docs operations/security-hardening`, `sovrium docs operations/gdpr-privacy`, `sovrium docs operations/logs-and-personal-data`, `sovrium docs auth/auth-overview`, `sovrium docs buckets/buckets-permissions`, `sovrium docs mcp/mcp-security`.
- **Sovrium's own pre-launch security checklist and per-app deployment baseline** — not shipped; their consequences for an app are in `sovrium docs operations/security-hardening` and `sovrium docs operations/gdpr-privacy`.
