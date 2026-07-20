# Contributing to Sovrium

Thank you for your interest in contributing to Sovrium. Sovrium is built in the
open, and contributions of all kinds are welcome — from typo fixes and
documentation improvements to bug reports and new features.

## Ways to contribute

- **Report a bug or request a feature** — open an issue with a clear description
  and, where possible, a minimal reproduction.
- **Improve the documentation** — corrections and clarifications are always
  welcome.
- **Submit a pull request** — implement a fix or feature and open a PR for
  review (requires certification — see below).

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

Starter configurations are available in the [`examples/`](examples/) directory.

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

For general questions, see the project [README](README.md). For commercial or
trademark licensing inquiries, contact **license@sovrium.com**.
