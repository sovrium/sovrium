# The Sovrium desktop shell

A native window and a tray item that supervise the Sovrium engine as a child process. The shell
reimplements nothing: it starts the engine binary, waits for it to serve, and shows what it serves.
Every capability the app has is a capability the binary already had.

Closing the window does not stop the engine — the window hides and the tray becomes the app. That is
deliberate: the point of the product is to edit the configuration in another application and watch
the change appear, which cannot happen if closing the window kills the server.

## Layout

| Path                           | What it is                                                                |
| ------------------------------ | ------------------------------------------------------------------------- |
| `src/`                         | The shell's own UI — plain TypeScript and Vite, no framework              |
| `src-tauri/src/`               | The Rust side: sidecar supervision, tray, settings, deep links, nav guard |
| `src-tauri/tauri.conf.json`    | Window, CSP, updater endpoint, and everything the installers carry        |
| `src-tauri/entitlements.plist` | The macOS entitlements the engine needs, JIT included                     |
| `src-tauri/windows/hooks.nsh`  | NSIS install hooks                                                        |
| `package.json`, `bun.lock`     | This directory's own dependencies — it does not share the repository's    |

Nothing here imports from the repository's `src/`. The two trees are built and shipped separately,
and the shell's brand tokens arrive as a generated CSS file rather than as an import.

## Prerequisites

Rust (stable, via rustup) and Bun. On Linux you also need the WebKitGTK 4.1 and GTK 3 development
packages; on macOS, the Xcode command-line tools.

## Building and running

```bash
bun install --cwd desktop

# Type-check the UI, build it, and compile the crate against a placeholder sidecar.
# This is what CI runs; it never produces a bundle.
bun run desktop:check

# The Rust unit tests — pure logic, no window.
cargo test --manifest-path desktop/src-tauri/Cargo.toml
```

To run or bundle the shell for real you first need an engine binary in place. The bundle embeds it
as a sidecar, which Tauri looks for at `desktop/src-tauri/sovrium-<target-triple>`; the file is
gitignored and is never committed.

```bash
# From the repository root: build the engine, then put it where Tauri expects it.
bun run build:binary
bun run scripts/build/stage-desktop-sidecar.ts --from ./sovrium

# Then, from this directory:
bunx tauri dev                                  # live-reloading window
bunx tauri build --debug --bundles app,dmg      # a real bundle, quickly
bunx tauri build                                # every target for this platform
```

`bun run scripts/build/stage-desktop-sidecar.ts --placeholder` writes a stub instead. That is enough
to compile and to bundle, and not enough to run — the app will open and do nothing, which is exactly
what a missing or unrunnable sidecar looks like. Use it for build checks only.

## The installers are not signed yet

Until the Apple and Azure enrolments complete, every lane produces a real, installable bundle that
the operating system warns about:

| Platform | What it does today                                                                   |
| -------- | ------------------------------------------------------------------------------------ |
| macOS    | Ad-hoc signed, not notarized. Gatekeeper reports an unidentified developer.          |
| Windows  | Unsigned. SmartScreen warns on first run and names no publisher.                     |
| Linux    | Unsigned, as is normal there. The AppImage and the `.deb` install without complaint. |

This is not a temporary bug to route around: the signing steps in the release workflow are all
conditional on their secrets existing, so the pipeline degrades instead of failing. Adding the
certificates turns them on with no code change. The published article "Troubleshooting: the Sovrium
App" is what a user is pointed at in the meantime.

## The updater key

`plugins.updater.pubkey` in `src-tauri/tauri.conf.json` is an empty string, and the shell ships that
way on purpose. The key is read when an update is **verified**, so an empty one makes an install fail
verification rather than skip it — the tray's check succeeds, the install then fails, and both reach
the user as a dialog. Neither blocks launch.

Generating it is the maintainer's to do once, and nobody else's — no CI job and no agent may do it:

```bash
bun run --cwd desktop tauri signer generate -w ~/.sovrium-updater.key
```

Note the absence of a `--` separator. Tauri's own documentation writes this command for npm, where
`--` is how arguments reach the script; with Bun the arguments pass straight through and a `--` is
handed to the Tauri CLI as an argument of its own, which fails. The command above prompts for the
password, so it never enters shell history.

Paste the **public** half into `plugins.updater.pubkey` as a literal string. It cannot be a file
path. The private half and its password go into the release secrets and an offline copy, because a
lost key ends updates for every copy already installed — there is no revocation and no way to
re-sign an installed base.

The full procedure, the secret names, and what the release pipeline does with each of them are in
`docs/infrastructure/release/release-script.md` and the desktop release checklist beside it.

## What the shell deliberately does not do

It does not edit configuration. There is no field, form, picker or canvas anywhere in this tree that
writes an app's configuration file, and the settings page covers the shell's own settings only — a
fixed port or none, whether to open the app in the default browser instead of this window, and whether
to check for updates at all. Editing happens in the user's own editor or AI client, against the file
on disk, and the engine's watcher applies it.

It also handles no AI credentials: "Connect your AI" reveals a folder and copies a snippet. The
connection is between the user's own tooling and the user's own machine.
