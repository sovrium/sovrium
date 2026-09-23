# Undo and Reset

> Going back to an earlier version of an app does not require git — under watch mode the engine keeps its own history of every config it accepted, and restoring one is a directory copy.

Every edit to a config is a change you may want to take back, and the person making it may have no git, no remote and no reason to learn either. So the engine keeps the history itself.

## The history directory

Under `--watch`, every config Sovrium **accepts and serves** is copied whole into the data directory:

```text
.sovrium/history/
  2026-09-22T21-18-51-411Z-9d950eca6a36/
    app.yaml
  2026-09-22T21-18-57-301Z-942914531bb5/
    app.yaml
    config/pages.yaml
```

Each directory is one accepted config, named for the instant it was accepted and the config hash the lock file records. A snapshot holds the **whole graph** — the root config and every `$ref` partial — at the relative paths they occupy in your project, so restoring one is a directory copy rather than a merge. A restore that has to merge is a restore that can half-fail.

Three rules decide what lands there, and each one is the feature:

- **The boot counts.** A snapshot is written when the watcher starts, not only on the first edit. Without it the history after one change holds exactly one entry — the state you are trying to leave — and undo has nowhere to go.
- **Only configs that served.** A refused save writes nothing. This is a list of configs that ran, not of configs that were attempted, and an entry that never booted is an undo target that breaks the app.
- **Twenty are kept**, oldest discarded first. `--watch` snapshots on every accepted save, so an afternoon of editing is hundreds of them; twenty is far more than the handful of steps anyone retraces by hand.

The watcher is one of two writers. The other is the config write tool described in **Your Config over MCP**, which records the state **before** its own edit — because an assistant editing a project with nothing running would otherwise have no history at all, the watcher being the only thing that ever reaches "accepted". It skips the copy when the newest entry already holds those exact bytes, so a watched project gets one entry before the edit and one after rather than three.

Otherwise it is written under `--watch` only — a plain `sovrium start` with no assistant attached creates no history directory at all.

## Restoring one

There is no restore command, deliberately. Copy the snapshot's files back over the project:

```bash
cp -R .sovrium/history/2026-09-22T21-18-51-411Z-9d950eca6a36/. .
```

The watcher sees the writes and the ordinary reload path serves the result, so undo needs no privileged code path — and a shell, a script, or a person with a file manager can all do it the same way. The config write tool's own undo is that same copy, choosing the most recent snapshot whose files differ from what is on disk.

Snapshots are best-effort. A history that cannot be written costs you one warning and nothing else, because a boot that failed over it would be a lost application rather than a lost convenience. A `$ref` reaching **above** the config's own directory is skipped rather than copied outside the snapshot directory, which leaves that snapshot incomplete — much the smaller of the two problems.

## In the Sovrium app

The desktop app reads the same directory and turns it into one button. **Go back one version** replaces the config file in your project folder with the previous snapshot, and the app reloads — the same copy the command above performs, with the timestamp shown so you can see which version you are returning to. Until a second snapshot exists there is nothing to go back to, and the app says so rather than offering a button that would do nothing.

**Reset to the template** is the other direction, and it is not part of the history. It replaces your config file with a fresh copy of the template the project started from, which is recorded at scaffold time. Your data, your uploaded files and everything else in the folder are untouched; only the config file is replaced, and every change you or your assistant made to it is lost. A project that did not start from a template has nothing to reset to, and the control says that instead.

Neither one reaches the operator console. The history holds no candidate configuration — every entry is a config that already booted — so it is not a version ledger, and the console stays what it is: a read-only view of operational data.
