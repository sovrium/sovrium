# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.x     | Yes       |

Only the latest release in the 0.x line receives security updates.

## Reporting a Vulnerability

Report a vulnerability **privately**, through a GitHub security advisory:
**[github.com/sovrium/sovrium/security/advisories/new](https://github.com/sovrium/sovrium/security/advisories/new)**.
The report is visible to the maintainers only, and lets you give the severity, the affected
versions and a reproduction in one place. If you cannot use GitHub, email
**security@sovrium.com** instead.

- You will receive an acknowledgment within **48 hours**.
- We will provide an initial assessment within **5 business days**.
- Never open a public issue, discussion or pull request for a vulnerability. The issue forms
  link to the advisory form for this reason.

We appreciate responsible disclosure and will credit reporters (with permission) in the release notes.

No third-party penetration test has been commissioned to date. The security work behind Sovrium is
internal: platform-wide standing rules, code review, and a specification suite that locks the
behavior. That is not the same as an independent audit and should not be read as one.

## Verifying the Safety Net

This repository is a **filtered mirror** of a private development monorepo, so the test suite, the
CI workflows, and the internal tooling are not present here. They exist, and they are described
with the current figures at
[sovrium.com/en/docs/how-sovrium-is-built](https://sovrium.com/en/docs/how-sovrium-is-built).

## Continuity

The engine is free forever in self-hosted mode: no license keys, no feature gating, no phone-home,
no kill switch. If this project ceases operations, every running instance keeps running, and the
BSL 1.1 license converts to Apache 2.0 on the Change Date stated in [LICENSE.md](LICENSE.md), with
no action required from anyone.

**If the company ceases operations, the private development infrastructure is released publicly.**
That means the specification suite, the CI pipeline, and the internal tooling. The reason for
holding them back is a going concern that would no longer exist, and whoever continues to run
Sovrium would need exactly those artifacts to maintain it.
