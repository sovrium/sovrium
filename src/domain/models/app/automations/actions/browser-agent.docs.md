# Browser Agent

> Give an AI agent a goal, a starting page and the secrets it may type, and let it drive the browser: the hosts it reaches, the secrets it uses and every submission stay under your control, never the model's.

A `browser/agent` action opens its `startUrl`, shows a model what the page offers, and lets it answer with actions: the gestures of a [`browser/run`](/en/docs/automation-browser-actions) step (`goto`, `click`, `fill`, `select`, `check`, `press`), naming elements with the same locators. The driver performs them and shows the page again, until the model reports the goal done or has taken `maxSteps` actions.

```yaml
automations:
  - name: read-monthly-statement
    trigger: { type: webhook, method: POST }
    actions:
      - name: readStatement
        type: browser
        operator: agent
        props:
          goal: 'Sign in, open the statement for {{trigger.data.period}} and report its total'
          startUrl: 'https://portal.example.com/login'
          allowedHosts: [portal.example.com]
          session: portal-admin
          maxSteps: 30
          credentials:
            portalEmail: $env.PORTAL_EMAIL
            portalPassword: $env.PORTAL_PASSWORD
            portalCode: '{{totp $env.PORTAL_TOTP_SECRET}}'
          output: { total: number, reference: string }
```

<!-- sovrium:options BrowserAgentActionSchema -->

## The model proposes, the driver decides

- **Hosts.** Every address the model asks for and every request a page makes goes through the same `allowedHosts` guard as a `browser/run`. A page that tells the agent to go elsewhere reaches nothing, and the model is told the address was blocked. A written-out `startUrl` on another host refuses the app when it starts.
- **Secrets.** The model is told the names in `credentials` and asks for one by name; the driver types the value. The value never reaches the model (the field is shown to it as `***`), nor the trace, a screenshot or an error. `credentials` is the only place the agent reads `$env`: the goal and the start address are sent to the model, so a `$env` reference in either is refused.
- **Page text is data.** What a page says reaches the model as the content of the page, apart from its instructions. A page saying "ignore your instructions" is a page saying something.
- **Sends wait for a person.** Any request a page sends to an allowed host with a method other than `GET` or `HEAD` is held in the browser when one of the agent's actions (a click, a key press, a fill, a choice, a tick) caused it. That includes a form posting data, and just as much a button whose script runs a `fetch` or an XHR POST. The run pauses with a screenshot of the page and the method and address of each held request (never what it carries), and the browser is held open for at most `BROWSER_HOLD_MAX_MS`. Approved, each held request is let go once, in the order the page sent it, and the page receives the site's answer; anything the page sends after that waits for a person again. Rejected or unanswered, none leaves. `GET` and `HEAD` always flow, so a search, a link or a page loading its data never waits. `approveSubmit: false` lets the agent send without asking, and lifts the two refusals below.
- **A sign-in goes through.** When every value the agent typed since the page loaded (or since its last send left) came from `credentials`, the sends of the action that follows are not held. That covers a sign-in form, or a sign-in page whose script posts the values. If the model typed even one value itself, or chose an option in a list, the action waits.
- **A page's own sends are refused.** A request with a body that a page sends by itself (on load, on a timer, after the action has settled) is refused, and so is every beacon (`navigator.sendBeacon`). The site receives nothing, the run goes on, and the trace lists them under `heldBack`. A site that loads its data by POST therefore shows the agent less than it shows a person; such a site needs `browser/run`, or `approveSubmit: false`.
- **WebSockets are refused** while sends are held, since what a socket sends cannot be held.
- **Chrome or Edge is required.** WebKit cannot hold a request, so on WebKit (the desktop app's fallback when neither is installed) the step fails before any page opens with `browser_backend_refused`, whatever `approveSubmit` says. Install Chrome or Edge, or set `BROWSER_BACKEND=chrome`.
- **The result is checked.** With `output`, the agent's answer must hold every declared field with its type; a missing or mistyped field fails the step naming it.

The model is reached the way every AI call is, local first unless the operator says otherwise. With `ECO_AI_PROVIDER_PRECEDENCE=local-only` and a local model that cannot call tools, the step fails with `agent_unavailable` rather than asking another provider.

## Output and refusals

The output is `{ summary, result, url, trace }`: `result` holds the fields declared in `output`, checked, and the trace lists each action the agent took, with credential values shown as `***`. Besides the refusals of `browser/run`:

| Code                      | When                                                                        |
| ------------------------- | --------------------------------------------------------------------------- |
| `agent_unavailable`       | no AI provider, or a local-only model that cannot call tools                |
| `max_steps_reached`       | `maxSteps` actions taken without the goal reported done                     |
| `output_invalid`          | the answer misses a declared `output` field, or holds one of the wrong type |
| `submission_rejected`     | a person rejected the submission, or did not answer within the hold         |
| `browser_backend_refused` | the browser is WebKit, which cannot hold a request                          |

A declared AI agent can drive a browser from a chat too, with the narrower `browser.use` tool described in [Agent Tools](/en/docs/agent-tools).
