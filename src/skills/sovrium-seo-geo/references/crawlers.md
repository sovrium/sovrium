# Crawlers and AI bots

## Contents

- Three kinds of bot
- User agents
- The policy is the operator's decision
- A middle position
- Expressing it
- What Sovrium does today
- Limits of any policy

Tags point to `sources.md`. The table reflects vendor documentation as recorded in the research notes (mid-2026); vendors add and rename bots, so check the linked pages before publishing a policy.

## Three kinds of bot

| Kind                       | What it does                                            | Honours robots.txt?                       |
| -------------------------- | ------------------------------------------------------- | ----------------------------------------- |
| Training crawler           | Collects pages to train models                          | The listed ones say so                    |
| Search / retrieval crawler | Indexes pages so an assistant can find and cite them    | The listed ones say so                    |
| User-initiated fetcher     | Fetches one page because a person asked an assistant to | Generally **no** — it acts for the person |

## User agents

| Token                | Operator     | Kind                                | Notes                                                                                                                          | Source |
| -------------------- | ------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------ |
| `GPTBot`             | OpenAI       | Training                            |                                                                                                                                | [S51]  |
| `OAI-SearchBot`      | OpenAI       | Retrieval                           | Used for ChatGPT search results                                                                                                | [S51]  |
| `ChatGPT-User`       | OpenAI       | User-initiated                      | Not governed by robots.txt                                                                                                     | [S51]  |
| `ClaudeBot`          | Anthropic    | Training                            |                                                                                                                                | [S52]  |
| `Claude-SearchBot`   | Anthropic    | Retrieval                           |                                                                                                                                | [S52]  |
| `Claude-User`        | Anthropic    | User-initiated                      | Not governed by robots.txt                                                                                                     | [S52]  |
| `Google-Extended`    | Google       | Training control token              | Not a crawler; controls use for Gemini training. Blocking it does **not** remove a site from AI Overviews, which use Googlebot | [S21]  |
| `Applebot-Extended`  | Apple        | Training control token              | Applebot still crawls for search                                                                                               | [S54]  |
| `PerplexityBot`      | Perplexity   | Retrieval                           | Compliance has been disputed publicly                                                                                          | [S53]  |
| `Perplexity-User`    | Perplexity   | User-initiated                      | Not governed by robots.txt                                                                                                     | [S53]  |
| `Meta-ExternalAgent` | Meta         | Training                            |                                                                                                                                | [S32]  |
| `Meta-WebIndexer`    | Meta         | Retrieval                           |                                                                                                                                | [S32]  |
| `CCBot`              | Common Crawl | Training (open dataset used widely) |                                                                                                                                | [S55]  |
| `Bytespider`         | ByteDance    | Training                            | No official documentation; compliance disputed                                                                                 | [S56]  |

## The policy is the operator's decision

Whether an app welcomes AI training, AI search, both or neither is a business decision for whoever runs the app. Present the trade-off; do not decide it for them:

- Blocking **retrieval** bots removes the site from those assistants' answers and citations.
- Blocking **training** bots does not affect search results, including Google's AI features.
- Nothing in `robots.txt` stops user-initiated fetchers or a bot that ignores it.

## A middle position

A common, evidence-backed default for a business site that wants to be found:

- allow retrieval crawlers: `OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`, `Meta-WebIndexer`;
- disallow training tokens: `GPTBot`, `ClaudeBot`, `Google-Extended`, `Applebot-Extended`, `Meta-ExternalAgent`, `CCBot`, `Bytespider`;
- add an advisory `Content-Signal` line stating the same intent.

```text
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: Meta-ExternalAgent
User-agent: CCBot
User-agent: Bytespider
Disallow: /

User-agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=no
Allow: /

Sitemap: https://acme.example/sitemap.xml
```

`Content-Signal` comes from Cloudflare's Content Signals Policy (CC0): `search` (building a search index), `ai-input` (using content as input to an AI answer), `ai-train` (training). It is advisory: it states a preference, it enforces nothing. [S58] The IETF AIPREF working group's vocabulary and attachment drafts (including a `Content-Usage` form) have no consensus yet; do not describe them as a standard. [S59]

Paid-crawl and blocking services at the network edge exist (for example Cloudflare's pay-per-crawl) and are an infrastructure decision, not config. [S57]

## What Sovrium does today

Sovrium generates `robots.txt` from the page list: one `User-agent: *` group, `Allow: /`, a `Disallow` line for each `/_` page (never for a noindex page), and the `Sitemap:` line. It has no option for per-bot rules today; an AI-crawler policy option is under consideration. Until one exists:

- serve a hand-written `robots.txt` from the reverse proxy or edge in front of Sovrium, keeping Sovrium's `Sitemap:` line and `/_` rules; or
- leave the default and state the gap in the report.

Never block the whole site with `Disallow: /` under `User-agent: *` to stop AI bots; it removes the site from search.

## Limits of any policy

- robots.txt is voluntary; logs are the only proof of what a bot did.
- User-initiated fetchers act for a person and ignore robots.txt by design.
- A page already in a training set stays there.
