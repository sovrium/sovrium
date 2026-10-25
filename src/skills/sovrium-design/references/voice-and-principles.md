# Principles, voice and the charter

The half of a design system that is prose rather than values: the convictions behind the tokens, how the app speaks, which routes belong to which zone, the mark, and the imagery rules. `sovrium design-system` renders all of it at the top of the brief, so whoever reads it gets the reasoning before the values. Manual: `sovrium docs theming/design`.

## Contents

- [Principles](#principles)
- [Voice](#voice)
- [The voice chart](#the-voice-chart)
- [Zones](#zones)
- [Logo](#logo)
- [Imagery](#imagery)

## Principles

`design.principles` is an ordered list of convictions.

```yaml
design:
  principles:
    - The patient's next step is always the loudest thing on screen
    - Calm over clever
    - Colour is spent on the action and on errors, nowhere else
```

- Two or three. More start to contradict each other.
- Each is something a reasonable designer could disagree with; "be user-friendly" constrains nothing.
- Principles outrank every default in this skill and in `sovrium-pages`: a finding that contradicts them is a question to the author, not a fix.

## Voice

`design.voice` is how the app speaks whatever the situation. Every field is optional.

| Field                                                          | Holds                                                                                                    |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `personality`                                                  | Traits that hold on every surface                                                                        |
| `pronoun`                                                      | How the app addresses the reader (`you`, `tu`, `vous`) — free text, because the register is per language |
| `prefer`                                                       | Patterns to reach for, each an instruction a writer can obey                                             |
| `avoid`                                                        | Patterns to refuse — put the work here: refusals are what stop plausible off-brand copy                  |
| `tone.empty`, `.loading`, `.error`, `.success`, `.destructive` | One instruction per moment: how to write it, never the literal string                                    |

```yaml
design:
  voice:
    personality: [warm, direct, never condescending]
    pronoun: you
    prefer:
      - 'Lead a call to action with its verb: Book, Cancel, Reschedule.'
      - Name the doctor and the time, never "your appointment".
    avoid:
      - No exclamation marks.
      - No medical jargon a patient did not use first.
    tone:
      empty: Say what this is, then the one next action.
      error: State what happened and the way forward. Never blame the patient.
      destructive: Name what is cancelled, and whether it can be undone.
```

- Literal strings live per language under `languages`; `tone` tells the writer how to write them.
- Declare the moments you have thought about and leave the rest out; an invented instruction is worse than none.
- Writing the words on a page against this voice — calls to action, labels, messages, the review checklist — is `sovrium-pages`.

## The voice chart

When the app has no voice and the author wants one, build a voice chart first: it turns the principles into writing rules a writer can obey. [S14][S17]

Columns are two or three of the product's principles; rows are five dimensions. Each cell is one instruction.

| Dimension      | Question it answers               | Example cell for "plain-spoken"              |
| -------------- | --------------------------------- | -------------------------------------------- |
| Vocabulary     | Which words do we use and refuse? | Say "cancel", not "void"                     |
| Verbosity      | How much do we say?               | One sentence per idea, one idea per sentence |
| Grammar        | Which constructions?              | Active voice, present tense                  |
| Punctuation    | Which marks, and which never?     | No exclamation marks                         |
| Capitalisation | Which case, where?                | Sentence case everywhere                     |

- Keep it to two or three principles; more and the cells contradict.
- Each cell is a candidate `prefer` or `avoid` line. Propose them to the author rather than writing a personality nobody asked for.

## Zones

`design.zones` maps route patterns to named zones and lets each zone's voice depart from the app's.

```yaml
design:
  zones:
    - { pattern: '/app/*', zone: product }
    - { pattern: 'everything else', zone: marketing }
```

- `pattern` is a declared route pattern, or the literal catch-all `everything else`.
- A zone's `voice` overrides per field: a declared `pronoun`, `prefer`, `avoid` or `tone` replaces that field for its routes; anything undeclared inherits. `personality` cannot be overridden — it is identity, not register.
- `density.byZone` reuses the zone names, so a product zone can run tighter than a marketing one.

## Logo

| Field        | Rule                                                                                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src`        | The mark shown in LIGHT mode — the dark-ink file. Root-relative (`/logos/mark.svg`) or `https://`; a bare relative path, `http://` and `data:` are refused             |
| `srcDark`    | The mark shown in DARK mode — the light-ink file. Named for the mode, not the ink, and the field most often filled backwards. Leave it out when one mark reads on both |
| `alt`        | Required with `src`: the app's name, not "logo"                                                                                                                        |
| `clearSpace` | Prose, relative to the mark ("the height of the mark on all four sides")                                                                                               |
| `minWidth`   | The one number: the smallest width it may be drawn at                                                                                                                  |
| `misuse`     | What must never be done to it — the half that changes behaviour                                                                                                        |

Prefer SVG: a mark is line art, sharp at every density, and is served as it is, never re-encoded.

## Imagery

How the app looks where tokens cannot reach.

- `iconSet` — the name of the one icon set every icon comes from. The highest-leverage field here: icon drift comes from three authors each picking a reasonable icon from three sets.
- `principles` — what an image is for here ("show the product working").
- `photography` — rules to obey ("no stock photography of people pointing at screens").
- `patterns` — texture, illustration style, background geometry.

Nothing in `imagery` names a file. Images are declared where they are used — pages, records, buckets.
