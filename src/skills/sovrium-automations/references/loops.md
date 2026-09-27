# Loops and re-triggering

## Contents

- How a loop happens
- What Sovrium guards and what it does not
- The guards you write
- Several automations on one table
- Detecting a loop
- Checklist

Manual: `sovrium docs automation-triggers/trigger-record-comment`, `sovrium docs automation-actions/automation-subworkflows`.

## How a loop happens

A record trigger watches `orders` for updates. Its action updates the same order (sets `last_synced_at`). That update is a new update event, which fires the trigger again, which updates the order again. The same happens across two automations: A updates `invoices` which B watches, B updates `orders` which A watches.

## What Sovrium guards and what it does not

- **Guarded:** a chain of `automation-call` steps. The calling action carries `maxDepth` (1–100, default 10) and the callee sees `{{trigger.depth}}`, so a chain that calls itself stops.
- **Not guarded today:** a record automation re-triggered by its own write, or two record automations triggering each other through table writes. Assume every write your action makes can fire every record trigger on that table, including its own.
- **Not fired by seeds:** `sovrium seed` writes directly and runs no automations.

## The guards you write

1. **`watchFields`**: list only the fields whose change should fire the automation, and never a field the automation itself writes.

   ```yaml
   trigger:
     type: record
     table: orders
     events: [update]
     watchFields: [status] # the action writes last_synced_at, which is not watched
   ```

2. **A transition condition**: fire when the value changed _into_ the state that matters, using `previousRecord`.

   ```yaml
   condition:
     conditions:
       - { field: '{{trigger.data.record.status}}', operator: equals, value: paid }
       - { field: '{{trigger.data.previousRecord.status}}', operator: notEquals, value: paid }
   ```

   Check the operator names against `sovrium docs automation-actions/automation-flow-control` before relying on them.

3. **A done flag** the automation sets and the condition checks, when there is no natural transition (`welcome_sent` is false → send, then set it true).

4. **Creating a record in the trigger table**: an automation on `tasks` create that creates a follow-up task will fire itself. Give generated records a marker (`source: automation`) and exclude it in the condition.

## Several automations on one table

- Write down, in the config next to them, which automations watch the table and which fields each writes.
- Make each automation correct whatever order they run in. Do not rely on one finishing before another starts.
- Two automations writing the same field is a design smell: merge them, or give the field one owner.

## Detecting a loop

- The run list for one automation grows by the second: `GET /api/automations/runs?automationName=<name>`.
- The same record id appears in consecutive runs with only an automation-written field changing.
- Fix: stop the server or remove the trigger, add the guard, and confirm with one test record that exactly one run happens per real change.

## Checklist

```
- [ ] No action writes a field in its own watchFields
- [ ] Update triggers have watchFields
- [ ] "Once per record" automations check previousRecord or a done flag
- [ ] Records created by automations are marked and excluded
- [ ] Cross-automation writes mapped; each automation order-independent
- [ ] Tested: one real change → exactly one run
```
