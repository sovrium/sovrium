# The AI Chat Component

> `ai-chat` — an embedded chat panel backed by one of the app's configured agents.

`ai-chat` is the only type in its category. It draws a chat panel wired to an agent the app declares. Its options sit beside `type`. It also accepts the `visibility` and `responsive` modules.

<!-- sovrium:options type:ai-chat -->

`agent` names an entry of `app.agents[]`; what the agent can do — its model, its tools, its memory, its approval rules — is configured there rather than here. `chatHeight` is the container height in pixels, and `showHistory` loads the previous conversation on arrival. `allowAttachments` is superseded by `attachments` (below): on its own it lets a reader pick files that are shown with their message and never sent, and each file's chip says so.

Every option listed above is written beside `type`. A config that still carries `agent`, `placeholder`, `chatHeight`, `showHistory` or `allowAttachments` under `props` keeps working, and where one of them appears in both places the one beside `type` is used. `voiceInput` is read beside `type` only.

```yaml
- type: ai-chat
  agent: support-assistant
  chatHeight: 480
  placeholder: 'Ask a question…'
  allowAttachments: true
```

The composer sends nothing until the page's script has run: its Send button waits for it, so a message never travels in the page address.

### What the panel is made of

The panel is drawn from the conversation types rather than markup of its own, so it looks and behaves like any other thread on the page. The transcript is a `message-scroller`: it scrolls inside the panel and keeps the latest turn in view. Each turn is a `message`, the reader's at the end of the line in the primary colour and the assistant's at the start in the muted one. Until a reply starts, a live `marker` says one is coming. The reply then streams into its bubble as it is written, drawn from its Markdown — bold, lists, links, code — which the server renders and sanitizes; the reader's own turn is shown exactly as typed. Above the answer, the model's reasoning is a collapsed "Reasoning" `marker`, and each tool the agent calls is a `marker` line naming it, which says in words when the call was denied or failed. With `showHistory`, a separator `marker` reading "Earlier conversation" closes the replayed turns. Picked files are `attachment` chips, removable until the message is sent.

The composer is an `input-group` around a text area. Enter sends the message, and Shift+Enter starts a new line.

While a reply streams, Stop takes the place of Send. Stopping keeps what had arrived and closes the answer with a "Stopped" `marker`. When the agent calls an action its approval rule holds for a person, the tool line waits with Approve and Deny buttons; approving runs the call and the answer goes on, denying writes nothing and the agent replies to the refusal. A call already decided elsewhere, in another tab for instance, closes with a line saying it no longer waits for a decision, and a question answered elsewhere closes the same way; neither shows an error. A decision that fails on the way leaves the call waiting, and Retry sends that decision again. After Stop or a decision, the keyboard focus returns to the message box.

### Conversations, edits and sources

Every saved turn carries its actions under it, as icon buttons. The reader's question has **Edit**: it opens the text in a box, and **Save and send** asks the new text as a new branch of the conversation, which the agent answers. The answer has **Regenerate**, which asks for another answer to the same question. Neither overwrites anything: the earlier version is kept beside the new one, and a turn with more than one version shows a pager ("2 / 2") to go back to it. A message sent after paging back carries on from the version on screen.

Set `conversations: true` to add a **Conversations** button above the transcript. It lists the signed-in person's conversations with the chat's agent, newest first, titled by their first question; choosing one shows where it stands and the next message carries it on, and **New conversation** starts an empty one. The list says when it is loading, when there are no conversations yet, and when it could not be read, with a Retry; a conversation with no title reads "Untitled conversation", and Escape closes the list.

```yaml
- type: ai-chat
  agent: quote-agent
  conversations: true
```

When the agent answers from its `knowledge`, each number its answer cites (`[1]`) is a link to the source, and the sources it cites are listed under the answer as chips, titled by the document's label with the passage the agent read.

### Attachments

Give the chat an `id` and an `attachments` block to let a reader send files with a question. Each picked file is uploaded at once to the bucket the block names, which must be declared in `buckets`. Its type is read from the file's content, not from its name, and a file of a type the chat does not accept, or larger than `maxSizeMb`, is refused: its chip says why and it is not sent. By default a chat accepts PDF, Word (`.docx`), CSV, Markdown and plain text, up to 10 MB. Add `image/png` or `image/*` to `accept` to take pictures; they reach the model as images only when the operator declares it can read them with `AI_VISION=1`. Without it, a question carrying a picture is refused, and the chat's error line says the assistant cannot read images.

```yaml
buckets:
  - name: chat-uploads
pages:
  - name: assistant
    path: /assistant
    components:
      - type: ai-chat
        id: assistant-chat
        agent: quote-agent
        attachments:
          bucket: chat-uploads
          accept: [application/pdf, text/csv]
          maxSizeMb: 10
```

A stored file can be opened from its chip by the person who uploaded it, and by nobody else; anyone else asking for it is told it does not exist. Its place in the bucket is never shown to the browser. It is kept until its conversation is deleted or the account is erased, which deletes it for good, and it is listed in the account's data export. A file sent with a question stays readable for the rest of that conversation: a follow-up can refer to it without attaching it again. The text read from it is given to the model for one turn at a time and never stored.

### Voice input

Set `voiceInput` on an `ai-chat` component (beside `type`, like every other option) to add a push-to-talk microphone button to the composer. The person holds the button while speaking. On release, the recording is transcribed by the speech-to-text endpoint the operator configures (`STT_*`), and the recording itself is never stored. With `mode: draft` (the default), the transcript is placed in the message box for review. With `mode: send`, it is sent at once. `language` is an optional two-letter hint. `quality` defaults to `fast`, because the person is waiting for the text. `maxDurationSeconds` caps a recording at 1 to 300 seconds, and 300 is the default. A recording larger than 25 MB is refused.

```yaml
- type: ai-chat
  agent: sales-assistant
  voiceInput: { mode: draft, language: fr }
```

## It degrades honestly where AI cannot run

An app may declare an agent on a deployment that has no AI provider configured. The renderer does not draw a broken composer in that case: it drops the island and renders a `role="status"` line saying that the assistant is unavailable here and naming the variables to set — `AI_PROVIDER`, and `AI_API_KEY` for a hosted provider.

The panel's own words follow the page's language — the notice, the message shown when a reply fails, the composer's buttons, the conversation list and, when the author sets none, the placeholder: English and French are built in, and any other language shows English.

That is a component telling the truth about itself, and it is correct as far as it goes — but it cannot give way to a _different_ component. The alternative to a composer is not a disabled composer; it is usually a search trigger, which is a different control with a different label, keyboard affordance and endpoint.

The `visibility` module is what expresses that. `runtime: ai` renders the component only where AI can run on this deployment — wherever a provider is configured, since every app has the built-in System Agent — and `unlessRuntime: ai` renders its alternative everywhere else:

```yaml
- type: ai-chat
  agent: assistant
  visibility: { runtime: ai }
- type: command
  visibility: { unlessRuntime: ai }
```

Naming the same capability in both halves on one component is refused when the config is decoded: AI either runs here or it does not, so the component would render on no instance at all — the opposite of what its author wrote, and invisible at runtime.
