# Copy is design

Words are part of the interface. A well-laid-out page with vague, padded or inconsistent copy is
not finished. The agent writes and reviews copy in the same pass as layout, and it writes in the
app's voice, not its own.

## Contents

- [The invariant](#the-invariant)
- [Read the app's voice first](#read-the-apps-voice-first)
- [The voice chart](#the-voice-chart)
- [The four moments, plus one](#the-four-moments-plus-one)
- [Mechanics](#mechanics)
- [Calls to action and buttons](#calls-to-action-and-buttons)
- [Vocabulary: one term per concept](#vocabulary-one-term-per-concept)
- [Notifications](#notifications)
- [Review checklist](#review-checklist)

## The invariant

**No word that isn't doing work.** That is not "as few words as possible".

- Cut adjectives, filler, redundant labels, restated headings and marketing hype.
- Keep the sentence that tells the visitor what happens next. An empty state or an error without its next action is a dead end, however clean it looks.
- If a sentence can be removed and nothing is lost, remove it. If removing it leaves the visitor guessing, keep it.

## Read the app's voice first

- The app's `design.voice` is the brief: `personality`, `pronoun`, `prefer`, `avoid`, and `tone` per moment. Read it with `sovrium design-system <config>`.
- The `pronoun` sets the address (for example "you", or a language's formal or informal form). Use it everywhere; never mix registers on one surface.
- Follow every `prefer` line and refuse every `avoid` line, even where this file says otherwise. The author's voice outranks these defaults.
- A zone may depart from the app's voice (`design.zones`); check which zone a page belongs to.
- Literal strings live in the app's translations when the app is multilingual, not hard-coded per page: `sovrium docs app-schema/languages`.
- When the app declares no voice, write plainly using this file, and propose a `design.voice` block to the author rather than silently inventing a personality.
- Voice options: `sovrium docs theming/design`.

## The voice chart

When the app has no voice yet and the author wants one, build a voice chart before writing
copy. It turns two or three product principles into concrete writing rules.

Columns are the product's principles (for example "reliable", "plain-spoken"); rows are the
five dimensions below. Each cell is one instruction a writer can obey.

| Dimension      | Question it answers               | Example cell for "plain-spoken"              |
| -------------- | --------------------------------- | -------------------------------------------- |
| Vocabulary     | Which words do we use and refuse? | Say "delete", not "purge"                    |
| Verbosity      | How much do we say?               | One sentence per idea; one idea per sentence |
| Grammar        | Which constructions?              | Active voice, present tense                  |
| Punctuation    | Which marks, and which never?     | No exclamation marks                         |
| Capitalisation | Which case, where?                | Sentence case everywhere                     |

- Keep the chart to two or three principles; more and they start to contradict.
- Each cell becomes a candidate `design.voice.prefer` or `avoid` line; propose them to the author.

## The four moments, plus one

Voice stays constant; tone shifts with the situation. Four moments need words that chrome alone cannot carry — empty, long task, error, success — and a fifth, the destructive confirmation, costs the visitor data when it is wrong. Each has a
`design.voice.tone` key. When the app declares one, follow it; when it does not, use the default
pattern below.

| Moment                  | `design.voice.tone` key | Default pattern                                              | Example                                                         |
| ----------------------- | ----------------------- | ------------------------------------------------------------ | --------------------------------------------------------------- |
| Nothing to show         | `empty`                 | What this is + the one next action                           | "No invoices yet. Create one, or import a CSV."                 |
| Waiting                 | `loading`               | What is happening + how long + whether the visitor may leave | "Importing 2,400 rows (about 30 s). You can leave this page."   |
| Something stopped       | `error`                 | What happened + why + what to do next; never accuse          | "That file is over 10 MB. Compress it or choose a smaller one." |
| It worked               | `success`               | One short confirmation; a next step only if there is one     | "Invoice sent."                                                 |
| About to lose something | `destructive`           | Name what is lost, how many, and whether it can be undone    | "Delete 12 contacts? This cannot be undone."                    |

- A moment's copy is two layers at most: the fact, then the guidance.
- Success carries no celebration: no exclamation marks, no emoji, no "Awesome".

## Mechanics

- **Sentence case** for headings, labels, buttons, menu items and tabs. Capitalise only the first word and proper nouns.
- **Present tense**, active voice: "Sends a reminder", not "A reminder will be sent".
- **Second person**, addressing the visitor with the app's pronoun. Avoid "we" as the voice of the interface unless the app's voice asks for it; never "I".
- **Plain words** at roughly a grade-7 reading level: short sentences, common words, one clause where one will do.
- **Specific over general**: numbers and names instead of "some" and "items" ("3 files failed", not "Some files failed").
- **Front-load**: put the word the visitor scans for first in labels and list items.
- **No exclamation marks** in interface copy. Confidence comes from precision.
- **Numbers as digits** in the interface ("3 records"), with units, and the app's locale formatting.
- **No jargon**: no internal identifiers, no system terms the visitor did not choose ("record", "field" and "table" only if the app already uses them with its visitors).
- **Links say where they go** ("Read the refund policy"), never "Click here" or a bare URL.
- **Placeholders show an example**, never an instruction the visitor needs after typing starts.

## Calls to action and buttons

- Lead with a verb: "Create invoice", "Export CSV", "Invite a teammate".
- Name the outcome, not the mechanism: "Save changes", not "Submit".
- Keep a button label to one to three words; the surrounding copy carries the explanation.
- Use the same verb on the button that the heading or dialog used ("Delete project?" → "Delete project").
- Never "OK", "Yes" or "No" on a confirmation; repeat the action.
- One primary call to action per view; secondary actions use quieter labels and styling.
- On Persuade surfaces, the call to action states what the visitor gets or does next ("Start a free trial"), never vague ("Learn more") when something concrete fits.

## Vocabulary: one term per concept

Inconsistent terms make visitors think two different things exist. Before writing a page, fill
this table for the app from its existing pages and its `design.voice`, then use it everywhere.

| Concept                       | Use              | Do not use                          | Where it appears         |
| ----------------------------- | ---------------- | ----------------------------------- | ------------------------ |
| <the thing a visitor creates> | <e.g. "project"> | <e.g. "workspace", "space">         | <nav, headings, buttons> |
| <removing it>                 | <e.g. "delete">  | <e.g. "remove", "trash", "destroy"> | <buttons, confirmations> |
| <the people involved>         | <e.g. "member">  | <e.g. "user", "collaborator">       | <settings, invitations>  |
| <saving work>                 | <e.g. "save">    | <e.g. "submit", "apply", "commit">  | <forms>                  |
| <signing in>                  | <e.g. "sign in"> | <e.g. "log in", "login">            | <auth pages, nav>        |

- Match the label in navigation to the page's heading, word for word.
- A term introduced once is reused, not paraphrased for variety.
- Offer the filled table to the author as `design.voice.prefer` / `avoid` lines, so the next agent inherits it.

## Notifications

- Batch related events into a digest instead of dripping one notification per event.
- Every notification says what happened, to what, and links to it.
- Send only what the recipient can act on or needs to know; everything else belongs in an activity log.
- Match the notification's wording to the in-app wording for the same event.

## Review checklist

Run this over every string on the page before the browser pass:

- [ ] Every string follows `design.voice` (`pronoun`, `prefer`, `avoid`, the matching `tone` key).
- [ ] Every empty and error state carries one next action.
- [ ] Every button starts with a verb and names its outcome.
- [ ] Sentence case everywhere; no exclamation marks; no emoji unless the app's voice asks for them.
- [ ] Every concept uses the one term from the vocabulary table.
- [ ] No sentence can be deleted without losing meaning.
- [ ] Every link says where it goes.
- [ ] Headings describe the section, and no heading restates the one above it.
- [ ] Multilingual apps: every new string exists in every declared language.
