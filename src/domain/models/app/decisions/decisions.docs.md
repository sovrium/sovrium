# Decision Records

> Declare the architecture decision records behind your configuration — why the app is the way it is, in Nygard's four parts, versioned with the config.

An operator who inherits a running app can read every property of it and still not know why any of them is the way it is. Why Postgres and not the SQLite default? Why is the margin column hidden from the workshop? A config file answers **what**, and a diff answers **what changed** — neither answers what it was in aid of.

So the reasoning moves somewhere the config does not travel to: a wiki, a shared page, a thread, a person who has left. It drifts within a release or two, and the app outlives it.

The `decisions` array puts the records **beside the configuration they decided**, in the same file, under the same review, shipped in the same binary:

```yaml
decisions:
  - id: ADR-002
    title: SQLite on the workshop PC
    status: superseded
    date: '2025-11-04'
    deciders:
      - Thomas
    supersededBy: ADR-007
    touches:
      - engine › DATABASE_URL
    context: Two people use the app and it runs on the machine in the workshop.
    decision: No DATABASE_URL. The app keeps its SQLite file beside the binary.
    consequences: Backups are whoever remembers to copy the file. No second service to run.
  - id: ADR-007
    title: Postgres for the shared instance
    status: accepted
    date: '2026-06-01'
    deciders:
      - Léa Fontaine
      - Thomas
    supersedes: ADR-002
    touches:
      - engine › DATABASE_URL
      - tables › quotes
    context: Fourteen accounts write to the app, two agents read it, and the nightly export locks the file for a minute.
    decision: DATABASE_URL points at a managed Postgres in eu-west-3. The binary is unchanged; the migrations run at boot as before.
    consequences: Backups are the provider's. The workshop PC no longer hosts anything.
```

## Record properties

<!-- sovrium:options DecisionSchema -->

`context`, `decision` and `consequences` are the three prose parts of a classic Nygard ADR. The shape is deliberately the one every ADR tool already uses, so a team arriving with a `docs/adr/` folder is transcribing rather than translating.

The whole array is optional. An app that declares no `decisions` is not an error case anywhere — it simply has an empty register.

## Status

`status` is what makes a register out of a pile of records:

| Value        | Meaning                                                                       |
| ------------ | ----------------------------------------------------------------------------- |
| `accepted`   | The decision stands, and the configuration reflects it.                       |
| `proposed`   | Still being made. A record an operator can read and disagree with beforehand. |
| `superseded` | Replaced by a later decision — or simply abandoned.                           |

A superseded decision is still a decision. Deleting it deletes the reason the current one exists, which is why the register keeps it rather than pruning it.

## What `touches` is

`touches` names what a decision was about, as the author wrote it: `engine › DATABASE_URL`, `tables › quotes`, `forms › quote-request`, or a bare `auth`. It is free display text, and **nothing dereferences it**.

It is deliberately never resolved against the configuration, and that is the register's central design decision rather than an omission. A decision necessarily outlives what it decided: the record above documents the SQLite era of an app that now runs Postgres, and a superseded record names configuration that is gone **by definition**. A cross-reference rule here would refuse a boot because the register was honest about its own history, and would teach you to delete the record instead of keeping it.

So a `touches` entry naming nothing that exists in your config boots, and round-trips verbatim. The `›` is a separator the reading surface renders, not a path the schema splits on — use whatever vocabulary your team already uses.

## Supersession

`supersedes` and `supersededBy` are **both authored**. Neither is derived from the other, because the config is a file a human reads and a derived field would put a row on the reader's screen that is in no file.

The price of authoring both ends is that they can disagree — and a one-sided link renders a lineage chip on one screen and a dash on the other. So the pair is cross-checked when the config is decoded, and these six shapes are refused at startup rather than rendered wrongly:

| Refused                                                        | Why                                                                    |
| -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Two records sharing an `id`                                    | Every lineage link resolves by id, so a duplicate names two decisions. |
| `supersedes` or `supersededBy` naming the record's own `id`    | A decision cannot replace the decision it is.                          |
| A link naming an `id` the register does not declare            | A cross-reference that navigates nowhere.                              |
| `A.supersededBy: B` without `B.supersedes: A`                  | Both ends are authored, so both must agree.                            |
| `supersededBy` present with a `status` other than `superseded` | The status and the lineage contradict each other.                      |
| A supersession cycle, `A → B → A`                              | A chain that closes on itself has no first decision and no last.       |

The converse of the fifth row is allowed and left alone: `status: superseded` with no `supersededBy` is the honest record of a decision that was abandoned, which is not the same thing as one that was replaced.

## Why the date is pinned

`id` accepts any non-empty string, and `date` does not. That is not an inconsistency.

The only property the register needs from an id is that a lineage link can resolve it, so pinning a pattern such as `ADR-\d{3}` would refuse `RFC-12`, `ARCH-001` and `D-7` — conventions teams actually use — for a house style.

A date has a reader. A register is ordered newest-first by comparing the raw strings, which is chronological for ISO-8601 calendar days and silently wrong for everything else: `01/06/2026` sorts beside `01/02/2025`, the page still renders, still answers `200`, and lies about which decision came last. So `date` must be `YYYY-MM-DD`, and anything else is refused at startup.

It is a calendar day rather than a timestamp, deliberately: an instant round-trips through a timezone that can move the day.

## Nothing edits a decision

The register is read-only wherever it is displayed. A decision is authored in the config, reviewed as a diff, and shipped with the app — which is the whole point of putting it there. An operator console that let someone rewrite the reasoning would reintroduce exactly the drift the register exists to end.
