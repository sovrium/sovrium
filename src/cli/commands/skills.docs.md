# Agent Skills

> `sovrium skills` writes the agent skills that match your Sovrium version into your project, and refreshes them when you upgrade without touching what you changed.

```text
Usage: sovrium skills [--output <dir>] [--target claude|agents|all] [--check] [--force]
```

An AI editing your config is only as good as what it knows about Sovrium. Left alone, it guesses from whatever it read during training: option names from an older release, a web page instead of the manual for your version, a config that validates but was never looked at in a browser. Agent skills close that gap. Each one is a short `SKILL.md` your AI reads when a task matches it, plus a `references/` folder it opens when it needs the detail.

The binary carries ten of them:

| Skill                  | Use it for                                                                       |
| ---------------------- | -------------------------------------------------------------------------------- |
| `sovrium-app`          | Any change to the config: the edit, validate, run, look, stop loop               |
| `sovrium-data-model`   | Tables, fields, field ids, relations                                             |
| `sovrium-pages`        | Pages, components, layout                                                        |
| `sovrium-design`       | The `design` block: colours, type, spacing, dark mode, component styles          |
| `sovrium-automations`  | Triggers, actions, connections                                                   |
| `sovrium-security`     | Sign-in, access to pages, forms and files, secrets, privacy, a launch review     |
| `sovrium-performance`  | A slow or heavy app: caching, images, indexes, the eco levers                    |
| `sovrium-agents`       | The app's own AI: agents, AI chat, AI fields, providers                          |
| `sovrium-seo-geo`      | Metadata, sitemaps, languages, redirects, and how pages read to AI search        |
| `sovrium-report-issue` | Telling a configuration error from a bug, and reporting a bug or a vulnerability |

Part of each `references/` folder is generated from the binary's own option descriptions, so a catalogue of field types or components always describes the version you run.

## What it writes

`sovrium skills` writes every skill into `.claude/skills/<name>/` under the current directory — the `SKILL.md` and its `references/` — and a `.sovrium-skills.json` beside them. It also writes one agent file, `.claude/agents/sovrium-config-editor.md`, described below. `--output <dir>` writes under another project root instead.

The JSON file records, for every file it wrote, a SHA-256 of its bytes and the Sovrium version that wrote it. Commit it with the skills: it is how the next run knows which files are Sovrium's and which ones you changed. Each `SKILL.md` also names its version in its frontmatter, as `metadata.product-version`.

`sovrium init` writes the same skills and the same agent file when it scaffolds a project, whether from the default starter, a `--template`, a template repository or `--from-url`. It never overwrites a skill directory or an agent file that is already there, and skips a `.claude/agents` folder that is a link, saying so.

## The config editor agent

Claude Code can hand a task to a subagent: a named assistant with its own instructions, chosen when a request matches its description. `sovrium skills` writes one, `.claude/agents/sovrium-config-editor.md`, for building or changing your app's configuration and proving the change in the running app.

It is not a second copy of the skills. It comes from the same place inside the binary, is recorded in the same `.sovrium-skills.json` (under `agents`, beside `files`), and is refreshed, checked and refused by the same rules. What it adds is the order of work around them:

- which skill to load for which request, with `sovrium-app` loaded from the start;
- `sovrium dev` as the way to run the app while editing, and how to read what it prints and the status file it names;
- the config MCP, for a client with no shell;
- the app's decision register, under `decisions:` in the config: read before planning, superseded rather than contradicted, and added to with proposed records you accept;
- what "done" means: validated, reloaded, looked at in the browser and checked through the API;
- an opt-in design-first pass for pages: say "design first" and it prototypes the change on a Claude Design canvas, waits for you to approve the boards, then imports them into your config.

Its frontmatter sets `model: inherit`, so it runs on whatever model your session uses. To run it on a smaller, faster model such as Haiku, ask Claude Code to use that model for the task, or change the line to `model: haiku`. That counts as an edit: every later `sovrium skills` keeps your file, names it, and still refreshes the skills, unless you pass `--force`. `sovrium skills --check` names it too, and still passes.

The agent file is for Claude Code only. `--target agents` does not write it, and `--target all` writes it once, under `.claude/`. It is not offered as an MCP prompt, and the config MCP cannot write it: it lives under `.claude/`, which the write tools refuse.

Sovrium runs no model and holds no AI key. The agent file is instructions; your own client and your own model do the work.

## Refreshing after an upgrade

After installing a new Sovrium version, run the command again:

```bash
sovrium skills
```

Files Sovrium wrote and you did not change are replaced with the new version's. A skill the new version no longer ships is removed, provided you did not edit it. A second run with nothing to do changes nothing.

## Files you edited

A file whose bytes no longer match what Sovrium recorded is yours now, and the command never overwrites it on its own. It keeps that file exactly as you left it, refreshes every other file it wrote, and exits 0, naming each kept file on its own line. The next runs keep naming it, so an edit is never forgotten after an upgrade. You can:

- keep your version, and leave that file behind Sovrium's on purpose, or
- run `sovrium skills --force` to take Sovrium's version. `--force` replaces only files Sovrium wrote; a file you added inside a skill folder stays.

A skill directory with a Sovrium name that Sovrium never wrote — your own `sovrium-app`, say — is refused even with `--force`: without the record, nothing proves it is Sovrium's to replace. The same holds for a `.claude/agents/sovrium-config-editor.md` you wrote yourself. Skills and agent files with other names are never read or touched.

### Symlinks

The command never writes, replaces or deletes anything through a symbolic link. If a skill folder, any file inside it, or `.sovrium-skills.json` is a link, it exits 1 naming the link and writes nothing, in any target. `--force` does not change that. Replace the link with a real file or folder, or remove it, then run the command again. `sovrium init` skips a skill whose folder is a link, says so, and writes the others.

The skills folder itself may be a link: pointing `.claude/skills` at `.agents/skills` to share one copy works, as long as the link resolves inside the project. A skills folder that leads outside the project is refused before anything is written.

## Checking in CI

```bash
sovrium skills --check
```

`--check` writes nothing. It exits 0 when every skill is current, and 1 when a file is missing or left over from an older version — listing each one. A file you edited is listed too, but does not fail the check on its own: it is what `sovrium skills` keeps on purpose, so running `sovrium skills` and then `sovrium skills --check` passes. Run it in CI to catch a project whose skills fell behind the binary its pipeline pins.

## Other agents: `--target agents`

Claude Code reads `.claude/skills/`, and so does Cursor. Codex, GitHub Copilot, Gemini CLI and OpenCode read `.agents/skills/`.

```bash
sovrium skills --target agents   # .agents/skills/
sovrium skills --target all      # both directories
```

Each directory keeps its own `.sovrium-skills.json`, so each is refreshed and checked on its own. `claude` is the default, and the only target that writes the config editor agent file.

## As MCP prompts

Claude Desktop has no shell to run `sovrium skills`, and does not read skill folders from your project. When it is connected through `sovrium mcp`, the same skills are there as MCP prompts: pick one from the prompt menu, and its `SKILL.md` text is added to the conversation. A prompt carries the `SKILL.md` alone, not its `references/`. **Your Config over MCP** covers connecting a client.

## What the skills are built on

The skills follow the Agent Skills format, and their advice is drawn from published sources: search-engine documentation for the SEO skill, public design and accessibility guidance for the pages skill, and published agent-skill collections for their structure. Each skill lists what it drew on, with the date and the licence, in its `references/sources.md`.
