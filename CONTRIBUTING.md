# Contributing to Sovrium

Thank you for your interest in contributing to Sovrium. Sovrium is built in the
open, and contributions of all kinds are welcome — from typo fixes and
documentation improvements to bug reports and new features.

## Ways to contribute

- **Report a bug or request a feature** — open an issue from one of the forms
  (see [Filing an issue](#filing-an-issue)).
- **Ask a question** — use [Discussions](https://github.com/sovrium/sovrium/discussions),
  not an issue.
- **Improve the documentation** — corrections and clarifications are always
  welcome.
- **Submit a pull request** — implement a fix or feature and open a PR for
  review (requires certification — see below).

## Filing an issue

Issues are opened from a form, one per kind: **Bug report**, **Feature: configuration
option**, **Feature: engine primitive**, **Feature: recipe**, and **Task**. Each form asks
for what a maintainer needs to act without coming back to you, and sets the issue's type
(Bug, Feature or Task) for you.

- **Before filing a bug**, run `sovrium validate` on your configuration (a configuration
  error is reported there, and is not a bug), search existing issues, and remove secrets and
  real records from anything you paste. `sovrium report` prefills the bug form for you.
- **Labels** are applied from your answers: one `domain:` label for the part of Sovrium the
  issue is about, one kind label (`bug:` or `feature:`), and a `status:` label that tracks
  triage. `status:ready` means the issue is accepted and its _Agent brief_ (acceptance
  criteria, affected paths, verification) is complete, so anyone can start from it. You may
  leave the Agent brief empty; a maintainer completes it.
- **Drafted with an AI assistant?** That is welcome. Tick the box at the end of the form, and
  check that every fact in the report is one you observed.
- **Security vulnerabilities are never issues.** Report them privately through
  [a security advisory](https://github.com/sovrium/sovrium/security/advisories/new); see
  [SECURITY.md](SECURITY.md).
- **GitHub is the only issue tracker you need.** Every problem with Sovrium as it ships
  belongs here. Maintainers keep their internal tooling work elsewhere, so an issue about
  that work is occasionally closed with "Tracked internally; closing here." That is not a
  rejection: the work continues, it is just not tracked on GitHub.

## Becoming a certified contributor

Opening issues and reporting bugs is open to everyone. **Submitting code, however,
requires becoming a certified contributor.** To get certified, contact us at
**contribute@sovrium.com** and we will guide you through the process.

We introduced this step deliberately. The volume of unsolicited, AI-generated
pull requests has made open contribution unsustainable for many projects —
maintainers end up spending more time triaging low-effort, machine-written
patches than building. Certification lets us:

- **Keep review capacity for real work** — we are not overwhelmed by a flood of
  automated, drive-by PRs.
- **Guarantee a high-quality contributor community** — certified contributors
  understand the codebase, the architecture, and the standards before they ship.

Certification is not a paywall and not a popularity contest — it is a short
conversation to confirm you are a person who will contribute thoughtfully. Once
certified, your pull requests are reviewed and merged like any other.

## Before you start

- Search existing issues and pull requests to avoid duplicating work.
- For anything non-trivial, open an issue first to discuss the approach before
  writing code — it saves everyone time.
- By contributing, you agree that your contribution is licensed under the
  project's [Business Source License 1.1](LICENSE.md).

## Development setup

Sovrium runs on [Bun](https://bun.sh) (1.3+). Clone the repository and install
dependencies:

```bash
git clone https://github.com/sovrium/sovrium
cd sovrium
bun install
```

Run the app from source:

```bash
bun run start path/to/your/app.ts
```

Validate a configuration file against the schema:

```bash
bun run src/cli/index.ts validate path/to/your/app.ts
```

Starter configurations are available in the [`templates/`](templates/) directory.

## Coding standards

- **TypeScript** throughout, written for the Bun runtime.
- **Conventional commits** — prefix messages with `feat:`, `fix:`, `docs:`,
  `refactor:`, `chore:`, etc.
- **Write `feat:` / `fix:` / `perf:` descriptions for a general audience** —
  these become the release notes readers see. Describe the behaviour that
  changed, not the internal ticket or task that motivated it.
- Keep changes focused — one logical change per pull request makes review
  faster.
- Match the surrounding code style; the repository's formatter and linter define
  the conventions.

## Submitting a pull request

1. Fork the repository and create a topic branch.
2. Make your change with a clear, conventional commit message.
3. Open a pull request describing **what** changed and **why**.
4. Respond to review feedback — maintainers will help shepherd the change to
   merge.

## License and trademark

- All contributions are licensed under the [Business Source License 1.1](LICENSE.md).
- Contributing code does not grant any right to the **Sovrium** name or logo.
  See [TRADEMARK.md](TRADEMARK.md) for how the brand may be used.

## Questions

For general questions, see the project [README](README.md) or ask in
[Discussions](https://github.com/sovrium/sovrium/discussions). For commercial or
trademark licensing inquiries, contact **license@sovrium.com**.
