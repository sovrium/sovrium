---
name: sovrium-report-issue
description: Use when something in a Sovrium app goes wrong and the question is whether to report it — a `sovrium start` or `sovrium build` that fails, an "Unexpected failure" from a sovrium command, a 500 answer or a request id, a "Report on GitHub" link or the "Report a problem" page in the operator console, an MCP tool answering an internal error, behaviour that contradicts `sovrium docs` — or when the user asks to file a bug, suggest a feature, or report a vulnerability or security problem in Sovrium itself. Rules out a configuration error first, builds a minimal reproduction, removes secrets, searches existing issues, prefills the issue with `sovrium report`, and completes the form with the user (Domain, kind of bug, a brief a fix can start from) for them to submit in the browser, never through the API or `gh issue create`; a vulnerability goes to the private advisory form and never to a public issue.
license: BSL-1.1
compatibility: Needs the sovrium binary on PATH for `sovrium report`; without a shell, the issue address can be built by hand (see references/issue-address.md)
metadata:
  author: sovrium
  version: '1.0.0'
---

# Reporting a problem with Sovrium

A bare agent that meets an error files it. It opens an issue for a typo in the user's own config, pastes the whole `app.yaml` with its passwords, writes a vulnerability up in public, opens a second issue for a bug reported last week, and submits on the user's behalf without showing them what it wrote. A report that reaches the maintainers should be a real Sovrium bug, small enough to reproduce, free of secrets, not already filed, and sent by the person who owns it.

Run the core loop from `sovrium-app` first: most "bugs" are configuration that the running binary reads differently from what the author meant.

## First, decide what this is

Answer these in order and stop at the first yes:

1. **Could it let someone read, change or break what they should not?** An access check that does not hold, a secret or another user's data in an answer, a way to run code or reach the server's network, a crash anyone can trigger from outside. Then it is a **vulnerability** — go to [Vulnerabilities](#vulnerabilities). Do not reproduce it against a system you do not own, and do not describe it anywhere public, this conversation's shared logs included.
2. **Does `sovrium validate` refuse the configuration?** Then it is a **configuration error**, not a bug. Fix it with the user; `sovrium report` itself refuses to build a bug report for a configuration that does not validate.
3. **Does the manual say Sovrium does this?** Look it up with `sovrium docs config <path>` and `sovrium docs search <words>`. Behaviour the manual describes is not a bug, even when it surprises; if the user wants it to work differently, that is a **feature** suggestion.
4. **Did Sovrium itself fail?** `Sovrium failed to start`, `Sovrium failed to build`, `Unexpected failure — Sovrium changed nothing.`, a `500` with a request id, an internal error from a tool: that is a **bug** report, and Sovrium has already filled most of it in.
5. **Does it contradict the manual, or the same config behave differently between two runs or two databases?** That is a **bug** too.

Messages that end with "how to fix it" are refusals — a port in use, a required variable not set, an unknown key. They are never bug reports, and Sovrium offers no report for them.

## Before anything is filed

```
- [ ] sovrium validate passes on the configuration in use (read `sovrium docs cli-api/cli-validate`)
- [ ] The manual was checked: sovrium docs config <path>, sovrium docs search <words>
- [ ] Known runtime problems were ruled out: `sovrium docs get-started/troubleshooting-runtime`
- [ ] The problem reproduces on the latest release (sovrium --version, sovrium update)
- [ ] A minimal reproduction exists: the smallest config that still shows it
- [ ] Secrets and personal data are out of everything that will be pasted
- [ ] Existing issues were searched, by the error's signature when there is one
```

**Shrink the reproduction.** Copy the project, then delete tables, pages, automations and fields one at a time, re-running the failing step after each, until removing anything more makes the problem go away. A report with a twenty-line config gets fixed; one with the whole app does not. Replace real names and values with neutral ones (`orders`, `customer`, `Ada Lovelace`).

**Remove secrets.** Follow [references/redaction.md](references/redaction.md). `sovrium report --config` removes credentials it can recognise, but the person filing is responsible for what the report says: read the attached config before it is submitted.

**Search first, open and closed.** A failure Sovrium reports carries a signature in its title, `[sig:3f9a1c07]`. Search the repository's issues for that signature, then for the main words of the title you would write (the error class, the command, the option), with no state filter so closed issues show too: `https://github.com/sovrium/sovrium/issues?q=is%3Aissue%20%22sig%3A3f9a1c07%22`. When an open issue matches, add what is new — the version, a smaller reproduction, a workaround — as a comment there, rather than opening a second issue. When a closed one matches and its fix shipped in a release older than the one the user runs, the bug is back: file a new report with Kind of bug `regression`, the **Last version that worked**, and the closed issue's number under **Related issues**.

## Filing with `sovrium report`

`sovrium report` builds the address of a new issue with the facts every report needs already filled in, and prints it. It never submits anything and makes no network request: the person opens the address, reads the form, completes it and submits it themselves.

| Situation                                    | Command                                     |
| -------------------------------------------- | ------------------------------------------- |
| A bug, with the configuration attached       | `sovrium report --config app.yaml`          |
| A bug, without attaching the configuration   | `sovrium report`                            |
| The failure Sovrium just printed             | `sovrium report --last-error`               |
| A server error the user has a request id for | `sovrium report --request-id <id>`          |
| A new option on something the config has     | `sovrium report --feature config-option`    |
| A capability nothing existing can build      | `sovrium report --feature engine-primitive` |
| An app or use case built from what exists    | `sovrium report --feature recipe`           |
| A vulnerability                              | `sovrium report --security`                 |

Add `--open` to open the form in the user's browser. Run `sovrium report --help` for the flags of the version installed.

`--request-id` reads the copy the server kept, so it runs where that server runs. A request id comes from the `requestId` of a `500` answer, the error page, the operator console's failed view, or an internal error a Sovrium MCP tool answered. When the server kept that error as one the operator can fix — a table missing from the database, a variable not set, a database it cannot reach — the command prints that fix instead of an address and exits with status 1: help the user apply it, and report nothing.

Without a shell — a chat with no tools, a phone — build the same address by hand with [references/issue-address.md](references/issue-address.md).

## Completing the form

The address opens one of five forms, and the form decides how the issue is typed and labelled. Pick it by what the report is:

| The report is                                                         | Form                           | `sovrium report`                            |
| --------------------------------------------------------------------- | ------------------------------ | ------------------------------------------- |
| Something Sovrium does wrong                                          | `bug.yml`                      | `sovrium report`, with the flags above      |
| A new option on something the configuration describes                 | `feature-config-option.yml`    | `sovrium report --feature config-option`    |
| A capability nothing existing can build                               | `feature-engine-primitive.yml` | `sovrium report --feature engine-primitive` |
| An app or use case assembled from what exists                         | `feature-recipe.yml`           | `sovrium report --feature recipe`           |
| A piece of work that is neither, such as a missing page in the manual | `task.yml`                     | none: build the address by hand             |

For an engine primitive, say in **Why existing pieces are not enough** which pieces you tried to compose and where they stop; an idea that can be built from what exists is a recipe or a configuration option instead.

Then fill, with the user:

1. **Domain**, the part of Sovrium the report is about. Every form asks for one, and it is a choice on the page. The values, and what each covers, are in [references/issue-address.md](references/issue-address.md#domain); pick the closest, the maintainers can move it.
2. **Kind of bug**, on the bug form: `regression` (it worked in an earlier version), `crash-or-data-loss` (a crash, or data lost or corrupted), `wrong-behaviour` (it does something other than the manual says), `performance` (too slow or too heavy), `ux-a11y` (confusing, inaccessible or visually broken), `compat` (it fails on one operating system, database, browser or install channel only). A failure Sovrium reported with a signature is `crash-or-data-loss` unless it worked before.
3. The form's own fields: **steps** as numbered actions anyone can follow, below the `Environment:` block the address put at its head, **expected** and **actual** as one sentence each, and **logs** with the exact error text.
4. **The Agent brief** at the end of every form. It is optional on the page, but an issue is worked on only once it is there, so write it:
   - **Acceptance criteria**: numbered lines, `Given <the app or the situation>, when <the person does this>, then <what they see>`, in terms of behaviour, not of code.
   - **Affected paths**: the areas of Sovrium involved when you can tell (the command, the configuration key, the page or the API route); leave it empty rather than guess at source files.
   - **Verification**: the command to run or the request to send that shows it fixed, such as `sovrium build app.yaml` exiting 0, or `curl -i <url>` answering `200`.
   - **Out of scope**: what this report deliberately does not ask for.
   - **Related issues**: the numbers of the issues the search found, as `#123`.
5. The two boxes: tick "This report was drafted with an AI assistant" whenever you wrote any of it, and tick "I ran `sovrium validate`" only when it ran and passed.

Show the user the finished form before they submit it.

## Submit through the form, in the browser

The issue is submitted by the user, on the form page the address opens, in their browser. Never create it any other way: not `gh issue create`, not the REST or GraphQL API, not an issue tool of a GitHub MCP server, even when one is at hand and the user asks you to "just file it". An issue created that way skips the form, so it arrives with no type and no labels, the Domain and Kind you chose are lost, and it waits in triage until a maintainer redoes them. Give the user the address (or `--open` it) and let them press submit.

## Vulnerabilities

```bash
sovrium report --security
```

prints the private advisory form, `https://github.com/sovrium/sovrium/security/advisories/new`, and fills nothing in. Only the maintainers read what is sent there.

- **Never** open a public issue, discussion, pull request or comment about it, and never put an exploit in a commit message.
- Write the advisory with the user: what is affected, the version, the smallest steps that show it, and what an attacker gains. Leave out real users' data and live credentials; describe them instead.
- If the vulnerability exposed a secret, tell the user to rotate it now, before anything is reported.
- When unsure whether something is a vulnerability, treat it as one. The private form is the right place for a question too.

## What never to do

- Create an issue through `gh issue create`, the GitHub API or an MCP issue tool, or submit the form for the user without them reading it first.
- File a bug for a configuration `sovrium validate` refuses, or for behaviour the manual describes.
- Paste a whole configuration, a database dump, a `.env` file, or the contents of `.sovrium/`.
- Put a link to the issue tracker on a page the app's own visitors see. They report problems to the app's operator, who decides what reaches Sovrium.
