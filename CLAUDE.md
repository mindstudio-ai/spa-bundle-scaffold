# MindStudio Custom Interface — SPA Scaffold

## What This Is

This is a Vite + React + TypeScript project used to build custom interfaces for MindStudio AI workflows. These interfaces are rendered inside the MindStudio platform (in a sandboxed iframe) and communicate with the host workflow via a bridge API.

## The One Rule

**You can only edit `src/App.tsx`.** Everything else (routing, CSS reset, build config, bridge, main.tsx) is pre-configured and must not be modified. Treat this as a single-file project.

## Local Dev

To develop locally against a running MindStudio sandbox:

```
npm run dev:local -- ws://<sandbox-host>:4387/remy
```

This syncs `src/App.tsx` bidirectionally with the remote sandbox. Use the remote sandbox preview URL to see your changes — there is no local preview.

## Bridge API (`src/bridge.ts`)

Import what you need from `'./bridge'`. Available exports depend on the interface type:

### `useTemplateVariables()` — hook (all interface types)
Returns a `{ [variableName: string]: any }` object with the current variable values. This hook is **reactive** — it polls `window.vars` and re-renders the component whenever the variables change. Variables can be updated at any time by the host workflow (e.g. as background work completes). Access values defensively — any key may be `undefined`.

### `useIsRunning()` — hook (all interface types)
Returns a `boolean` indicating whether the host workflow is doing background work. Use this to show loading/progress states while the workflow is processing. Reactively updates when the running state changes.

### `submit(values)` — User Input interfaces
Submits form values. Signature: `(values: { [variableName: string]: any }) => void`. Show a loading state after calling — the transition takes time.

### `update(partialValues)` — Workbench interfaces
Shallow-merges values into the form state. Signature: `(partialValues: { [variableName: string]: any }) => void`. Call on every change (including keypresses). No submit button — saves are automatic.

### `approve(value)` / `reject()` — Revise Variable interfaces
`approve` submits the revised value: `(value: any) => void`. `reject` cancels without updating: `() => void`.

### `next(menuOptionId?)` — Menu and Generate Asset (HTML output) interfaces
Transitions to the next workflow step. For menus: `(optionId: string) => void`. For asset HTML: `() => void`. Show a loading state after calling.

### `uploadFile(file)` — all interface types
Uploads a file and returns a CDN URL: `(file: File) => Promise<string>`. Handles errors/validation internally. Show a loading state while awaiting.

## Interface Types

The user will tell you (or it will be obvious from context) which type of interface they're building:

- **User Input** — A form that collects values for specified variables. Use `submit` to send them.
- **Revise Variable** — Edit a single variable value that was set by a previous workflow step. Use `approve`/`reject`.
- **Workbench** — A compact inspector panel (~400px wide, 100svh tall) for the MindStudio IDE. Use `update` on every change. No submit button. Support light and dark mode via `@media (prefers-color-scheme: dark)`. Include a title and subtitle. Design for power users — think DAW/VFX plugin aesthetics.
- **Menu** — A selection interface where the user picks an option. Call `next(optionId)` immediately on selection — no submit button unless explicitly requested.
- **Generate Asset** — A template that renders data from `useTemplateVariables()` into a visual output (HTML page, PNG, PDF, or MP4 video). For HTML output, a `next()` function is available for "Continue" buttons.

## Style & Design Guidelines

- Use `styled-components`. Do not create a global style (one is already applied with CSS reset and `border-box`).
- A CSS reset is already applied. Default font is the system font stack.
- Deliver world-class, modern, clean design. Think Linear, Stripe, iOS — not Bootstrap templates.
- Use the full page for backgrounds. Make it responsive across mobile and desktop.
- Modern sans-serif fonts with strong typography and visual hierarchy.
- Clean, vibrant colors. No full-screen gradients unless incredibly subtle.
- No parallax, no cheesy JS effects, no unnecessary animations.
- No hand-drawn SVGs.
- Keep it minimal — no tags, footer notes, or unnecessary UI chrome. Let the content shine.
- Use remote resources (e.g. Google Fonts), never self-hosted font packages like fontsource.
- Do not use valid `<form>` tags — store values in state and use `onClick` handlers.
- Packages can be installed simply by importing them (the dev server auto-installs missing packages).

## Code Conventions

- Always provide the **complete, fully rewritten** `src/App.tsx` — never partial diffs.
- Use `useTemplateVariables()` values defensively (any property may be `undefined`).
- Pre-fill form fields from `useTemplateVariables()` when values are defined.
- For Generate Asset templates: use the most structured version of data available (e.g. prefer arrays over giant strings). Guard against unexpected shapes.
- Always show loading states after calling `submit`, `next`, `approve`, or while awaiting `uploadFile`.
