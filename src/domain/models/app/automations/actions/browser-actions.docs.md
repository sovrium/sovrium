# Browser Actions

> Drive a real browser through fixed steps, for a website or a service that has no API: sign in, fill a form, submit it, read the confirmation back. The browser is the operator's own — a Chrome on the machine, a Chrome running as a separate service, or, in the desktop app on a Mac, the system's WebKit — and it can only reach the hosts the action lists.

A `browser/run` action plays its `steps` in order, in one browser session. Each step is `{ do: <verb>, … }` and finds the element it acts on with a `target` locator. When every step went through, the action's output holds the address the page ended on, what the run read, its screenshots and a trace of every step.

```yaml
automations:
  - name: file-declaration
    trigger:
      type: webhook
      method: POST
    actions:
      - name: portal
        type: browser
        operator: run
        props:
          allowedHosts: [portal.example.com, login.example.com]
          session: portal-account
          idempotencyKey: 'declaration-{{trigger.data.period}}'
          steps:
            - do: goto
              url: https://portal.example.com/declarations/new
            - do: fill
              target: { label: Email }
              value: $env.PORTAL_EMAIL
              optional: true
            - do: fill
              target: { label: Password }
              value: $env.PORTAL_PASSWORD
              optional: true
            - do: click
              target: { role: button, name: Sign in }
              optional: true
            - do: select
              target: { label: Period }
              option: '{{trigger.data.period}}'
            - do: fill
              target: { label: Amount }
              value: '{{trigger.data.amount}}'
            - do: click
              target: { role: button, name: Submit declaration }
              irreversible: true
              confirm:
                message: 'Submit the declaration for {{trigger.data.period}}?'
            - do: assert
              url: /confirmation
            - do: extract
              target: { testId: reference }
              as: reference
```

<!-- sovrium:options BrowserRunActionSchema -->

When the steps cannot be written down in advance, a [browser agent](/en/docs/automation-browser-agent) lets a model drive the same browser towards a goal, within the same limits.

## Switching it on

Browser automation is off on a server until the operator turns it on with `BROWSER_PROVIDER=webview`; the desktop app turns it on by itself. While it is off, the app still starts and validates, and a browser step fails with `browser_unavailable`, naming the variable. The browser and its limits are set with the `BROWSER_*` variables, described in [Environment Variables: Browser Automation](/en/docs/env-vars-browser).

## Finding an element

A locator says what a person sees before it says how the page is built, and takes exactly one way of finding its element:

| Way             | Finds                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| `role` + `name` | An element by its ARIA role (`button`, `link`, `textbox`, `heading`, `status`, …) and its accessible name |
| `label`         | The form field a label names                                                                              |
| `text`          | The innermost element whose text contains it                                                              |
| `placeholder`   | A field by its placeholder text                                                                           |
| `testId`        | The element whose `data-testid` it is                                                                     |
| `selector`      | A CSS selector — the last resort, the first thing a redesign breaks                                       |

Text is matched case-insensitively as part of a longer text, unless `exact: true`. Only visible elements match. A locator that finds more than one element fails the step and says how many matched, unless `nth` picks one. Elements inside a frame from the page's own origin are found like any other; a frame from another origin cannot be reached, and a step looking for an element inside one fails with `frame_cross_origin`.

Each step waits for its element up to its `timeoutMs`, then fails — or, when the step is `optional`, is skipped and the run carries on. `dismiss` clicks an overlay such as a cookie banner if it shows, and carries on either way.

## When a site renames an element

`selfHeal: true` lets a run get through a small redesign. When a step misses its element, the driver shows a model the page's outline (the roles, names and labels of what is on screen) and the locator that missed, and asks for one other locator. The step is retried once with it, and only when it names exactly one visible element of a kind the step can act on: a field for `fill`, a box for `check`, a list for `select`, a file field for `upload`. A suggestion that matches several elements, or the wrong kind of element, is not used, and the step fails naming it.

Self-healing only suggests. The run reports every guess it used under `healed` in its output, as the locator to paste into the config, and the config is never written:

```json
{
  "healed": [
    { "step": 3, "from": { "label": "Amount (EUR)" }, "suggested": { "label": "Amount due (EUR)" } }
  ]
}
```

It never applies to a click marked `irreversible`, to an `optional` step, or to `assert`, `waitFor` and `dismiss`. `heal: false` keeps one more step out; `heal: true` turns it on for one step of a run without `selfHeal`, and is refused when the app starts on an `optional` step or an irreversible click. `selfHeal: { agent: <name> }` uses the model of that declared agent, and nothing else of it.

The model is reached like every AI call, local first unless the operator says otherwise (`ECO_AI_PROVIDER_PRECEDENCE`). What the page shows is sent as page content, never as instructions, and a field holding a value typed from `$env` is shown as `***`. With no AI provider configured, a miss fails as it would without `selfHeal`, and the error says no suggestion could be asked for.

## Values, secrets and one-time codes

Every value is filled in when its step is reached: it can read the trigger, earlier steps, and what this run read a moment earlier (`{{steps.<action>.extracted.<name>}}`). A value written as `$env.NAME` is typed into the page and recorded nowhere: not in the run's stored input, not in its trace, not in an error. So is a one-time code: `{{totp $env.NAME}}` types the current six-digit code for the base32 secret held in that variable.

A secret read from `$env` — a one-time code included — can only be read by the `value` of a `fill` step, the one field that is never recorded. Anywhere else it would be shown: an address in the trace and the run output, an option, a checked text or a locator in the trace and in error messages, a confirmation message to the people asked to approve. So a step that reads `$env` in any other field refuses the app when it starts, naming the step and the field.

One exception: the `url` of a `goto` step may read a variable the app declares with `secret: false`, such as a base address that changes from one environment to the next (`url: $env.PORTAL_BASE_URL/declarations`). The address is then shown in the trace and the run output like any other. A `goto` address that reads a variable declared without `secret: false`, or one the app does not declare at all, refuses the app when it starts, naming the automation, the step and the variable; a one-time code is never accepted in an address. A site that only accepts a secret in its address (a token in the query) cannot be driven safely and is not supported.

The trace shows every value a step typed, except a value read from `$env` and a value marked `sensitive: true`, which read `***`. As everywhere in a run's history, any text equal to the value of an environment variable the app declares reads `***` too, wherever it came from, unless that variable is declared `secret: false`. Fields holding a `$env` or `sensitive` value are painted over in every screenshot.

## What the browser can reach

Every request the page makes — a page, an image, a script, a form post, a redirect, a fetch — is checked before it leaves: only the hosts in `allowedHosts` are reached, and a private-network address is refused unless the operator allows private outbound calls (`SOVRIUM_ALLOW_PRIVATE_OUTBOUND`). Pages are served with a policy that also stops WebSockets and service workers towards other hosts — and towards a private-network address listed in `allowedHosts`, under the same operator setting — and no window is ever opened: a link meant for a new window opens in the same one. A `goto` written out in the config whose host is not listed refuses the app at start-up; one filled in from run data fails its step with `host_not_allowed` before the browser moves.

WebRTC and WebTransport, which open connections of their own that no request check can see, are taken away from every page and every frame before the page's first script runs: a site that needs a video call or a peer-to-peer connection does not get one in a browser step.

A click that leads to a file to download rather than a page fails with `navigation_not_document`. Dialogs are answered for the page: an `alert` is accepted, a `confirm` is answered no, a `prompt` gets an empty answer, and each one is recorded in the trace.

On the desktop app's WebKit browser the check is made on every address the run opens or ends on, but not on the files a page loads, and WebRTC stays available to pages: the browser acts for the person on their own machine.

## Submitting once

Mark the click that commits something — submits, pays, sends, deletes — with `irreversible: true`. It is never retried, by the step's `retry` or the automation's, and a failure after it is reported as `outcome_unknown` instead of being replayed.

With `idempotencyKey`, a key that already went through skips the whole browser run: no browser is opened and no step is played, not even the sign-in. The action answers the `reference` stored the first time, with `skipped: already-submitted`, and the automation's later actions carry on with it. A key whose earlier run stopped after its irreversible click without confirming it answers `outcome_unknown` and submits nothing: a person checks on the site.

`confirm` on an irreversible click asks a person first. The run waits with the browser open on the filled form, a screenshot of it attached to the request; approved, the same browser makes the click; rejected, or unanswered within `confirm.timeout` (never longer than `BROWSER_HOLD_MAX_MS`), the browser is closed and nothing is submitted. Approvers answer it like any approval request.

## Sessions

With `session`, a run starts from the cookies the last successful run of that session left, so its sign-in steps can be `optional` and are skipped while the site still knows it. A run that fails saves nothing. On Chrome the stored cookies are encrypted with the instance's key, and every run starts from an empty cookie jar; on the desktop app's WebKit browser, the session is kept in its own folder under the data directory.

## Screenshots and the trace

`artifacts.screenshots` decides when a picture of the page is kept: `failure` (the default, one when the run fails — its error names the file), `steps` (one after every step) or `off`. A `screenshot` step always keeps its own. Pictures go to the system bucket, or the declared bucket `artifacts.bucket` names, and are deleted after `BROWSER_ARTIFACT_RETENTION_DAYS` (30 days by default), counted from the run's start.

The trace lists every step with its status (`ok`, `skipped` or `failed`), its duration, the address it ended on, what it typed, and any dialog it met. An `extract` with `all` that read fewer elements than matched says how many it left out.

## Limits

A run is held to `timeouts.runMs` (by default `BROWSER_RUN_TIMEOUT_MS`): past it the browser is closed and the step fails. A file attached with `upload` weighs at most 10 MiB in all, or the step fails with `upload_too_large`. Browser runs take turns: on Chrome one runs at a time, and the next waits for it. Browser actions never solve CAPTCHAs and never disguise the browser from a site's bot detection, and no setting turns either on: when a site answers with a challenge, the run fails at the next step that does not find what it expects.
