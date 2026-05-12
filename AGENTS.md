# WebSocket chat integration — merchant admin frontend

## Context

You are working on `vue-typescript-admin-template`, a Vue 2 + TypeScript merchant admin
application. A Spring AI–based food delivery customer service agent already exists on the
backend and exposes a plain WebSocket endpoint at the path `/ws/agent/chat`. The project requires 
Node.js version 16.20.2.

Your job is to wire the frontend to that endpoint. You will create:

1. A Vuex chat module (`src/store/modules/chat.ts`)
2. An `AgentChatDrawer` Vue component (`src/components/AgentChatDrawer.vue`)
3. Environment variable entries in `.env.development` and `.env.production.uat`
4. A single registration line in the root layout component

Do not modify any existing pages, router config, Vuex modules, or API utilities.

---

## Coding rules

### 1. Think before coding

Before writing any code for a task, output a short reasoning block:

- State your interpretation of the task. If ambiguous, list interpretations and stop —
  do not pick one silently.
- List assumptions about existing code you cannot verify from files in the repo. Flag
  each one explicitly.
- If a simpler solution exists, name it and recommend it even if it reduces scope.
- If anything is unclear, output: `BLOCKED: <what is unclear>` and stop.

### 2. Simplicity first

Produce the minimum code that satisfies the requirement. Then stop.

- No additional methods, fields, or computed properties beyond what the task requires.
- No abstraction for logic used in only one place.
- No optional configurability that was not requested.
- No error handling for states the existing code makes impossible.
- Threshold: If a component exceeds 150 lines (template + script combined), the agent must evaluate for actual redundancy. 
  * Strict Prohibition: Do NOT compress normal structures or sacrifice readability (e.g., merging lines, obscure shorthand) solely to reduce line count.   

Action: Only remove explicit bloat. If the structure is already optimized but remains over 150 lines, provide a brief justification of the blocks before submitting.

### 3. Surgical changes

- Edit only the files the task requires.
- Do not reformat, rename, or reorganise anything outside the lines you are changing.
- Match the existing code style in every file: class-based components with
  `vue-property-decorator`, TypeScript, 2-space indentation.
- If you introduce an import or variable that your changes then make unused, remove it.
  Do not remove pre-existing unused code.
- If you spot unrelated dead code, note it in your reasoning block. Do not touch it.

### 4. Goal-driven execution

For any task with more than one step, begin with a plan:

```
1. [action] → verify: [concrete check]
2. [action] → verify: [concrete check]
```

Do not advance to the next step until the current step's verify condition passes.

---

## Frontend stack — constraints

- **Vue 2.6** with `vue-property-decorator` and `vue-class-component`. Use class-based
  component style throughout. Do not use the Composition API or Options API.
- **TypeScript 3.6**. No features beyond this version.
- **Element UI 2.x**. Use `el-drawer`, `el-scrollbar`, `el-button`, `el-input`,
  `this.$message` for notifications. Do not introduce any other UI component library.
- **Vuex 3** with `vuex-module-decorators`. Match the existing module registration pattern
  in `src/store/index.ts`.
- **No browser storage**. Do not use `localStorage`, `sessionStorage`, or
  `vuex-persistedstate` for chat state. All chat state lives in memory only.
- **Token retrieval**. The app already has a utility for retrieving the auth token (used
  in `axios` interceptors). Use that same utility — do not introduce a new one. If you
  cannot find it in the repo, output `BLOCKED: cannot locate token utility` and stop.
- **No new dependencies**. Use the native browser `WebSocket` API. Do not add any npm
  packages.

---

## Message protocol

This is the agreed contract with the backend. Do not deviate from these frame shapes.
If the backend's actual implementation differs from what is documented here, note the
discrepancy and ask before adjusting either side.

**Client → server — user message (one frame per turn):**
```json
{
  "conversationId": "string — UUID, generated once on drawer open",
  "userId": "string — from Vuex user store",
  "message": "string — raw user input"
}
```

**Server → client — token (streaming chunk):**
```json
{
  "type": "token",
  "content": "string — one token or small chunk"
}
```

**Server → client — confirmation required:**
```json
{
  "type": "confirmation",
  "intent": "CANCEL_ORDER | REQUEST_REFUND | CHANGE_ADDRESS",
  "orderId": "string | null",
  "question": "string — agent's human-readable confirmation prompt",
  "reason": "string — why confirmation is needed"
}
```

**Client → server — confirmation reply:**
```json
{
  "conversationId": "string",
  "userId": "string",
  "confirmation": true,
  "intent": "string — echo back the intent field from the confirmation frame"
}
```

**Server → client — done:**
```json
{
  "type": "done",
  "intent": "string — resolved intent name"
}
```

**Server → client — error:**
```json
{
  "type": "error",
  "message": "string — user-safe description"
}
```

---

## Environment config

Add to `.env.development`:
```
VUE_APP_WS_URL=ws://localhost:8080/ws/agent/chat
```

Add to `.env.production.uat` (matches the existing `build:uat` script):
```
VUE_APP_WS_URL=wss://uat-api.your-domain.com/ws/agent/chat
```

Use `process.env.VUE_APP_WS_URL` in the component. Do not hardcode any URL.

---

## Vuex chat module

**File:** `src/store/modules/chat.ts`

State shape — flat, no nesting:

```typescript
interface ChatMessage {
  role: 'user' | 'agent'
  content: string
  timestamp: number
}

interface ConfirmationFrame {
  intent: string
  orderId: string | null
  question: string
  reason: string
}

interface ChatState {
  messages: ChatMessage[]
  loading: boolean
  pendingConfirmation: ConfirmationFrame | null
}
```

Implement mutations for:

| Mutation | Effect |
|---|---|
| `PUSH_MESSAGE` | Appends a `ChatMessage` to `messages` |
| `APPEND_TOKEN` | Concatenates `content` onto `messages[last].content` |
| `SET_LOADING` | Sets `loading` boolean |
| `SET_CONFIRMATION` | Sets `pendingConfirmation` (pass `null` to clear) |
| `RESET` | Resets state to initial values |

No actions. No getters beyond what `@State` decorators provide.
Do not register this module in `vuex-persistedstate` paths.
Register the module in the existing store index — match the existing style exactly.

---

## `AgentChatDrawer` component

**File:** `src/components/AgentChatDrawer.vue`

### Layout

- A fixed floating button, bottom-right corner, `position: fixed; bottom: 32px; right: 32px`.
  Use an `el-button` with `type="primary"` and `circle`. Icon: a chat/message icon from the
  existing icon set if available, otherwise a plain label "Chat".
- An `el-drawer` with `direction="rtl"`, `size="380px"`, `:visible.sync="drawerVisible"`,
  `:with-header="false"`.
- Inside the drawer, three vertical sections:
  1. **Header bar** — fixed height, shows "AI Assistant" label and a close button.
  2. **Message list** — fills remaining height, wrapped in `el-scrollbar`. Scrolls to bottom
     on each new message.
  3. **Input area** — fixed at drawer bottom. Contains `el-input` (type textarea, autosize,
     max 3 rows) and a Send `el-button`. Hidden and replaced by confirmation UI when
     `pendingConfirmation` is non-null.

### Confirmation UI

When `pendingConfirmation` is non-null, render below the last agent message bubble:

- The agent's `question` text in a distinct bubble (e.g. slightly different background).
- Two `el-button` elements side by side: "Confirm" (`type="primary"`) and "Cancel"
  (`type="default"`).
- Hide the text input while confirmation is pending.

### WebSocket lifecycle

- **Open:** on the first time `drawerVisible` becomes `true`. Not on component mount.
- **URL:** `${process.env.VUE_APP_WS_URL}?token=${token}` where `token` comes from the
  existing token utility.
- **conversationId:** generate once with `crypto.randomUUID()` when the connection opens.
  Store as a component data property — not in Vuex.
- **Close:** when `drawerVisible` becomes `false`. Set `socket = null`.
- **Reconnect:** open a new connection the next time the drawer opens.

### Incoming frame handling

Handle in `socket.onmessage`. Parse `JSON.parse(event.data)` and switch on `frame.type`:

| Frame type | Action |
|---|---|
| `token` | If `messages` last entry is an agent message in progress, call `APPEND_TOKEN`. Otherwise `PUSH_MESSAGE` with `role: 'agent'` and empty content first, then `APPEND_TOKEN`. |
| `confirmation` | Call `SET_CONFIRMATION` with the frame payload. |
| `done` | Call `SET_LOADING(false)`. Auto-scroll message list to bottom. |
| `error` | Call `SET_LOADING(false)`. Call `this.$message.error(frame.message)`. |

### Sending a user message

1. Call `PUSH_MESSAGE` with `role: 'user'` immediately (optimistic render).
2. Call `SET_LOADING(true)`.
3. Send the user frame JSON via `socket.send(...)`.
4. Clear the input field.
5. Disable the input and send button while `loading` is true.

### Sending a confirmation reply

1. Send the confirmation reply frame via `socket.send(...)`.
2. Call `SET_CONFIRMATION(null)`.
3. Call `SET_LOADING(true)`.

### Registration

Add the component to `src/App.vue` or whichever single root layout wraps all pages.
Make the minimum change: one import line and one `<AgentChatDrawer />` tag at the end of
the root template. Do not touch anything else in that file.

---

## Verification steps

```
1. Add .env entries
   → verify: console.log(process.env.VUE_APP_WS_URL) in main.ts prints the correct URL
             in both dev and uat modes

2. Implement Vuex chat module
   → verify: unit test (Jest) confirms each mutation produces the correct state:
             PUSH_MESSAGE appends; APPEND_TOKEN concatenates; RESET clears all

3. Implement AgentChatDrawer — connection + token streaming
   → verify: run dev server, open drawer, send a message, confirm token chunks
             appear in a single streaming bubble and loading clears on done frame

4. Implement confirmation UI
   → verify: manually set pendingConfirmation in Vuex DevTools, confirm inline
             Confirm/Cancel buttons appear and input is hidden; clicking Confirm
             sends the correct reply frame (inspect in browser Network > WS tab)
```

---

## What NOT to build unless explicitly asked

- No reconnection or heartbeat logic.
- No message history on drawer open — starts fresh each session.
- No typing / loading indicator beyond the `loading` boolean disabling the input.
- No sound or browser notification.
- No markdown rendering — plain text bubbles only.
- No pagination or virtual scroll in the message list.
- No unit test for the Vue component itself — manual verification is sufficient for now.
