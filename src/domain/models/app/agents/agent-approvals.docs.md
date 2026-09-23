# Agent Permissions & Approval

> Two different questions — who may set an agent in motion, and which of its actions stop and wait for a person once it is running.

## Who may invoke

```yaml
agents:
  - name: support-agent
    role: support
    systemPrompt: You are a courteous support assistant.
    permissions:
      type: agent
      trigger: [admin, member]
```

<!-- sovrium:options AgentPermissionsSchema -->

| Value             | Admits                                                                       |
| ----------------- | ---------------------------------------------------------------------------- |
| omitted           | Any signed-in caller, and nobody else                                        |
| `authenticated`   | Any signed-in caller — the same rule, said out loud                          |
| `all`             | Everyone, anonymous callers included; the explicit opt-in for a public agent |
| `[admin, member]` | Callers holding a listed role; `admin` satisfies any role array              |

**Omitting the grant does not leave the agent open.** An agent with no declared grant is reachable by any signed-in caller and by nobody else; an anonymous request is refused. A genuinely public agent — a support bot on a marketing page — has to say so.

That default costs a deployment nothing, because an app declaring agents without authentication is refused at startup: there is always a way to hold a session.

### A refusal answers 404

A caller the grant does not admit gets `404` — never `403`, never `401` — and the body names no agent. The agent's name sits in the URL, so an answer distinguishing "exists, but not for you" from "no such agent" would let anyone map your deployment one guess at a time. The two responses are byte-identical.

The practical consequence, worth knowing before you debug one: on these routes the 404 **is** the permission error. There is no 403 to go looking for.

### It governs reading as well as invoking

The grant covers every surface that sets the agent in motion — a chat panel, the execute endpoint, the manual schedule trigger, an automation — and also the surfaces that read it **back**: its definition, its schedule, its token usage, its pending approvals.

Those readbacks serve the system prompt, the task prompt and the tools allowlist, which is precisely the material somebody would want in order to aim a prompt injection at the agent.

Listing the agents requires a session in every case, including on a deployment where some agent is public. `all` opens one agent to invocation; it does not open your inventory to enumeration. A caller who clears that gate still sees only the agents they may individually trigger.

One surface sits outside the grant on purpose: the agent's own cron. A timer is not an external caller, so restricting who may invoke an agent does not stop it running on its own.

The grant does **not** govern what the agent may then do — that remains its role plus its allowlist. A viewer allowed to trigger an admin-role agent is triggering something more privileged than themselves, so read the grant as delegation and set it deliberately.

## Approval

It inserts a person between the model's decision and its effect.

<!-- sovrium:options AgentApprovalSchema -->

<!-- sovrium:options AgentApprovalEscalationSchema -->

`mode` is `none`, `all`, or `selective` — which requires the `required` list, itself a subset of the agent's actions. `timeout` is in seconds and defaults to 3600.

```yaml
approval:
  mode: selective
  required: [record.delete, email.send]
  timeout: 1800
  escalation:
    after: 600
    to: admin
```

Read that as a timeline. The agent decides to send an email and the request goes to a human. Ten minutes later nobody has acted, so it escalates. Twenty minutes after that the timeout hits and the request expires unexecuted.

**`after` must be less than `timeout`.** An escalation scheduled at or past the expiry never fires — the request dies before anyone is asked. Leave enough room after the escalation for the escalated-to role to actually respond: an escalation at 600 with a timeout at 660 is technically valid and practically useless.

## Choosing a mode

| Mode        | Right when                                                                   |
| ----------- | ---------------------------------------------------------------------------- |
| `none`      | Every action the agent can take is reversible and low-stakes                 |
| `selective` | Most work is routine but a few actions leave the building — the usual answer |
| `all`       | A new agent you do not yet trust, or one whose whole remit is consequential  |

The discipline for `selective` is to ask of each action: if the model gets this wrong, can I undo it? An update on an audited table is recoverable. A sent email is not — the message is gone. Neither is a ban, from the banned user's point of view.

Running `all` for a fortnight after deploying a new agent is a cheap way to learn what it actually does before narrowing. The approval queue doubles as a log of intentions.

## Approval and scheduling together

A scheduled run respects approval. An agent with `mode: all` on a nightly cron does not execute in the small hours — it queues a request that sits until somebody arrives, and expires if the timeout passes first.

That combination is usually a mistake, and worth naming: an unattended trigger paired with an attended gate produces an agent that reliably does nothing overnight. Either narrow to `selective` so the routine part proceeds, or accept that the schedule only prepares work for the morning.
