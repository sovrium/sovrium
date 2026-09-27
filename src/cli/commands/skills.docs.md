# Agent Skills

> `sovrium skills` writes the agent skills that match your Sovrium version into your project, and refreshes them when you upgrade without touching what you changed.

```text
Usage: sovrium skills [--output <dir>] [--target claude|agents|all] [--check] [--force]
```

An AI editing your config is only as good as what it knows about Sovrium. Left alone, it guesses from whatever it read during training: option names from an older release, a web page instead of the manual for your version, a config that validates but was never looked at in a browser. Agent skills close that gap. Each one is a short `SKILL.md` your AI reads when a task matches it, plus a `references/` folder it opens when it needs the detail.

The binary carries five of them:

| Skill                 | Use it for                                                                |
| --------------------- | ------------------------------------------------------------------------- |
| `sovrium-app`         | Any change to the config: the edit, validate, run, look, stop loop        |
| `sovrium-data-model`  | Tables, fields, field ids, relations                                      |
| `sovrium-pages`       | Pages, components, design                                                 |
| `sovrium-automations` | Triggers, actions, connections                                            |
| `sovrium-seo-geo`     | Metadata, sitemaps, languages, redirects, and how pages read to AI search |

Part of each `references/` folder is generated from the binary's own option descriptions, so a catalogue of field types or components always describes the version you run.

## What it writes

`sovrium skills` writes every skill into `.claude/skills/<name>/` under the current directory — the `SKILL.md` and its `references/` — and a `.sovrium-skills.json` beside them. `--output <dir>` writes under another project root instead.

The JSON file records, for every file it wrote, a SHA-256 of its bytes and the Sovrium version that wrote it. Commit it with the skills: it is how the next run knows which files are Sovrium's and which ones you changed. Each `SKILL.md` also names its version in its frontmatter, as `metadata.product-version`.

`sovrium init` writes the same skills when it scaffolds a project, whether from the default starter, a `--template`, a template repository or `--from-url`. It never overwrites a skill directory that is already there.

## Refreshing after an upgrade

After installing a new Sovrium version, run the command again:

```bash
sovrium skills
```

Files Sovrium wrote and you did not change are replaced with the new version's. A skill the new version no longer ships is removed, provided you did not edit it. A second run with nothing to do changes nothing.

## Files you edited

A file whose bytes no longer match what Sovrium recorded is yours now, and the command refuses to overwrite it. It exits 1 and names each such file. You can:

- keep your version, and leave that file stale on purpose, or
- run `sovrium skills --force` to take Sovrium's version. `--force` replaces only files Sovrium wrote; a file you added inside a skill folder stays.

A skill directory with a Sovrium name that Sovrium never wrote — your own `sovrium-app`, say — is refused even with `--force`: without the record, nothing proves it is Sovrium's to replace. Skills with other names are never read or touched.

### Symlinks

The command never writes, replaces or deletes anything through a symbolic link. If a skill folder, any file inside it, or `.sovrium-skills.json` is a link, it exits 1 naming the link and writes nothing, in any target. `--force` does not change that. Replace the link with a real file or folder, or remove it, then run the command again. `sovrium init` skips a skill whose folder is a link, says so, and writes the others.

The skills folder itself may be a link: pointing `.claude/skills` at `.agents/skills` to share one copy works, as long as the link resolves inside the project. A skills folder that leads outside the project is refused before anything is written.

## Checking in CI

```bash
sovrium skills --check
```

`--check` writes nothing. It exits 0 when every skill is current, and 1 when a file is missing, left over from an older version, or edited — listing each one. Run it in CI to catch a project whose skills fell behind the binary its pipeline pins.

## Other agents: `--target agents`

Claude Code reads `.claude/skills/`, and so does Cursor. Codex, GitHub Copilot, Gemini CLI and OpenCode read `.agents/skills/`.

```bash
sovrium skills --target agents   # .agents/skills/
sovrium skills --target all      # both directories
```

Each directory keeps its own `.sovrium-skills.json`, so each is refreshed and checked on its own. `claude` is the default.

## As MCP prompts

Claude Desktop has no shell to run `sovrium skills`, and does not read skill folders from your project. When it is connected through `sovrium mcp`, the same skills are there as MCP prompts: pick one from the prompt menu, and its `SKILL.md` text is added to the conversation. A prompt carries the `SKILL.md` alone, not its `references/`. **Your Config over MCP** covers connecting a client.

## What the skills are built on

The skills follow the Agent Skills format, and their advice is drawn from published sources: search-engine documentation for the SEO skill, public design and accessibility guidance for the pages skill, and published agent-skill collections for their structure. Each skill lists what it drew on, with the date and the licence, in its `references/sources.md`.
