# The AI Chat Component

> `ai-chat` — an embedded chat panel backed by one of the app's configured agents.

`ai-chat` is the only type in its category. It draws a chat panel wired to an agent the app declares. Its options sit beside `type`. It also accepts the `visibility` and `responsive` modules.

<!-- sovrium:options type:ai-chat -->

`agent` names an entry of `app.agents[]`; what the agent can do — its model, its tools, its memory, its approval rules — is configured there rather than here. `chatHeight` is the container height in pixels, `showHistory` loads the previous conversation on arrival, and `allowAttachments` lets a reader attach a file to a message.

Every option listed above is written beside `type`. A config that still carries `agent`, `placeholder`, `chatHeight`, `showHistory` or `allowAttachments` under `props` keeps working, and where one of them appears in both places the one beside `type` is used. `voiceInput` is read beside `type` only.

```yaml
- type: ai-chat
  agent: support-assistant
  chatHeight: 480
  placeholder: 'Ask a question…'
  allowAttachments: true
```

### Voice input

Set `voiceInput` on an `ai-chat` component (beside `type`, like every other option) to add a push-to-talk microphone button to the composer. The person holds the button while speaking. On release, the recording is transcribed by the speech-to-text endpoint the operator configures (`STT_*`), and the recording itself is never stored. With `mode: draft` (the default), the transcript is placed in the message box for review. With `mode: send`, it is sent at once. `language` is an optional two-letter hint. `quality` defaults to `fast`, because the person is waiting for the text. `maxDurationSeconds` caps a recording at 1 to 300 seconds, and 300 is the default. A recording larger than 25 MB is refused.

```yaml
- type: ai-chat
  agent: sales-assistant
  voiceInput: { mode: draft, language: fr }
```

## It degrades honestly where AI cannot run

An app may declare an agent on a deployment that has no AI provider configured. The renderer does not draw a broken composer in that case: it drops the island and renders a `role="status"` line saying that the assistant is unavailable here.

The notice, and the message shown when a reply fails, follow the page's language: English and French are built in, and any other language shows English.

That is a component telling the truth about itself, and it is correct as far as it goes — but it cannot give way to a _different_ component. The alternative to a composer is not a disabled composer; it is usually a search trigger, which is a different control with a different label, keyboard affordance and endpoint.

The `visibility` module is what expresses that. `runtime: ai` renders the component only where AI can run on this deployment — wherever a provider is configured, since every app has the built-in System Agent — and `unlessRuntime: ai` renders its alternative everywhere else:

```yaml
- type: ai-chat
  agent: assistant
  visibility: { runtime: ai }
- type: command-palette
  visibility: { unlessRuntime: ai }
```

Naming the same capability in both halves on one component is refused when the config is decoded: AI either runs here or it does not, so the component would render on no instance at all — the opposite of what its author wrote, and invisible at runtime.
