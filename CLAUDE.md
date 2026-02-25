# MindStudio Custom Interface — SPA Scaffold

## What This Is

This is a Vite + React + TypeScript project used to build custom interfaces for MindStudio AI workflows. These interfaces are rendered inside the MindStudio platform (in a sandboxed iframe) and communicate with the host workflow via a bridge API.

## The One Rule

**You can only edit `src/App.tsx` and `src/OpenGraphCard.tsx`.** Everything else (routing, CSS reset, build config, bridge, main.tsx) is pre-configured and must not be modified.

## Local Dev

To develop locally against a running MindStudio sandbox:

```
npm run dev:local -- ws://<sandbox-host>:4387/remy
```

This syncs editable files (`src/App.tsx` and `src/OpenGraphCard.tsx`) bidirectionally with the remote sandbox. Use the remote sandbox preview URL to see your changes — there is no local preview.

## Bridge API (`src/bridge.ts`)

Import what you need from `'./bridge'`. Available exports depend on the interface type:

### `useTemplateVariables()` — hook (all interface types)
Returns a `{ [variableName: string]: any }` object with the current variable values. This hook is **reactive** — it polls `window.vars` and re-renders the component whenever the variables change. Variables can be updated at any time by the host workflow (e.g. as background work completes). Access values defensively — any key may be `undefined`.

**Streaming & progressive updates:** Template variables often update rapidly and incrementally — for example, a variable might stream in token-by-token from an AI model, or multiple variables might arrive at different times as earlier workflow steps complete. Design for this:
- **Render progressively when possible.** If text is streaming in, show it as it arrives rather than waiting — this feels responsive and gives the user something to read immediately. Use Framer Motion's `layout` animations to keep things smooth as content grows.
- **Wait when it makes sense.** Some UI (like a chart, a summary card, or a layout that depends on all data being present) looks broken mid-stream. In those cases, gate rendering on the data being complete (e.g. check `useIsRunning()` or whether key fields are populated) and show a clean loading state until then.
- **Don't thrash.** Avoid triggering expensive re-layouts or re-animations on every poll tick. Use `AnimatePresence` for enter/exit rather than re-animating content that's just growing. Memoize derived computations when the underlying data updates frequently.

### `useIsRunning()` — hook (all interface types)
Returns a `boolean` indicating whether the host workflow is doing background work. Use this to show loading/progress states while the workflow is processing. Reactively updates when the running state changes.

### `submit(values)` — User Input interfaces
Submits form values. Signature: `(values: { [variableName: string]: any }) => void`. Watch useIsRunning to show a loading state - the transition can take a LOT of time depending on the workload. If isRunning is true, don't allow the user to submit anything.

### `update(partialValues)` — Workbench interfaces
Shallow-merges values into the form state. Signature: `(partialValues: { [variableName: string]: any }) => void`. Call on every change (including keypresses). No submit button — saves are automatic.

### `approve(value)` / `reject()` — Revise Variable interfaces
`approve` submits the revised value: `(value: any) => void`. `reject` cancels without updating: `() => void`.

### `next(menuOptionId?)` — Menu and Generate Asset (HTML output) interfaces
Transitions to the next workflow step. For menus: `(optionId: string) => void`. For asset HTML: `() => void`. Show a loading state after calling.

### `uploadFile(file)` — all interface types
Uploads a file and returns a CDN URL: `(file: File) => Promise<string>`. Handles errors/validation internally. Show a loading state while awaiting.

### `requestFile(options)` — all interface types
Prompt the user for a file. User can choose to upload a file or choose a file from their media/assets library on the platform: `(options?: { type?: 'image'|'video'; }) => Promise<string>`. Handles errors/validation internally. Show a loading state while awaiting. Always use requestFile for media (images/videos), except if you are supporting dropping files. The best pattern is to support direct file upload via drop, and requestFile when the user explicitly clicks a button to upload.

## Utility Components

### `<StreamingText />` (`src/StreamingText.tsx`)

A convenience component for rendering text that streams in progressively (e.g. AI-generated content arriving via `useTemplateVariables()`). Tokenizes incoming text by word boundaries and uses CSS animations (not JS) so each new token fades in smoothly without flicker.

```tsx
import { StreamingText } from './StreamingText';

const vars = useTemplateVariables();
<StreamingText value={vars.aiResponse} />
```

**Props:**
- `value` — the text to render. As this string grows, only the new content fades in.
- `animate` — set to `false` to disable the fade. Default `true`.
- `duration` — CSS duration string. Default `'0.6s'`.
- `className` / `style` — applied to the outer `<span>` wrapper.

Renders inline — drop it anywhere text goes. Handles value resets gracefully (re-animates from scratch). Use this whenever displaying a variable that streams in over time.

## Interface Types

The user will tell you (or it will be obvious from context) which type of interface they're building:

- **User Input** — A form that collects values for specified variables. Use `submit` to send them.
- **Revise Variable** — Edit a single variable value that was set by a previous workflow step. Use `approve`/`reject`.
- **Workbench** — A compact inspector panel (~400px wide, 100svh tall) for the MindStudio IDE. Use `update` on every change. No submit button. Support light and dark mode via `@media (prefers-color-scheme: dark)`. Include a title and subtitle. Design for power users — think DAW/VFX plugin aesthetics.
- **Menu** — A selection interface where the user picks an option. Call `next(optionId)` immediately on selection — no submit button unless explicitly requested.
- **Generate Asset** — A template that renders data from `useTemplateVariables()` into a visual output (HTML page, PNG, PDF, or MP4 video). For HTML output, a `next()` function is available for "Continue" buttons.

## Open Graph Card (`src/OpenGraphCard.tsx`)

When the app is loaded with `?mode=screenshot`, it renders `src/OpenGraphCard.tsx` instead of `src/App.tsx`. This component is screenshotted programmatically and used as the Open Graph sharing image for the app (the preview that appears when the link is shared on social media, iMessage, Slack, etc.).

**How it works:**
- The screenshot request hits `/?mode=screenshot` with a 1200×630 viewport (standard OG image dimensions).
- All the same template variables are available via `useTemplateVariables()` — the card has access to the same data as the main app.
- The renderer waits ~1 second for the component to paint before capturing.
- The resulting screenshot becomes the app's `og:image`.

**Design guidelines for OG cards:**
- The component must render at exactly **1200×630px** (use a fixed-size wrapper, not `100svh`).
- Design for impact at a glance — this is a thumbnail. Bold typography, high contrast, simple layout.
- Use images from template variables where possible (resize via the Image CDN to fit). A card with a relevant image is far more clickable than text alone.
- Keep text minimal — a title and maybe one line of context. No paragraphs.
- No interactive elements, animations, or loading states — this is a static capture.
- Use `useTemplateVariables()` defensively as always — any value may be `undefined`. Fall back to sensible defaults so the card always looks complete.

**When to create an OG card:** Only for interfaces that produce a shareable output — **Generate Asset** and **Menu** types. User Input, Revise Variable, and Workbench interfaces are forms/tools, not shareable artifacts, so they don't need OG cards. Leave `src/OpenGraphCard.tsx` at its default for those.

For asset/output interfaces: if the user doesn't specifically ask about the OG card, you should still create a reasonable one alongside the main app. Use the app's key data (title, hero image, summary) to build a compelling sharing image. Users can always refine it later, but having a good default out of the box matters — a well-designed sharing card makes a big difference in engagement when the link is posted.

## Style & Design Guidelines

- Use `styled-components`. Do not create a global style (one is already applied with CSS reset and `border-box`).
- A CSS reset is already applied. Default font is the system font stack.
- Deliver world-class, modern, clean design. Think Linear, Stripe, iOS — not Bootstrap templates.
- Use the full page for backgrounds. Make it responsive across mobile and desktop.
- Modern sans-serif fonts with strong typography and visual hierarchy.
- Clean, vibrant colors. No full-screen gradients unless incredibly subtle.
- No parallax, no cheesy JS effects, no gratuitous animations.
- No hand-drawn SVGs.
- Keep it minimal — no tags, footer notes, or unnecessary UI chrome. Let the content shine.
- Use remote resources (e.g. Google Fonts), never self-hosted font packages like fontsource.
- Do not use valid `<form>` tags — store values in state and use `onClick` handlers.
- Packages can be installed simply by importing them (the dev server auto-installs missing packages).

### Animation with Framer Motion

`framer-motion` is included as a dependency — use it. Tasteful motion can elevate an interface from "functional" to "polished." Import `motion` and `AnimatePresence` from `'framer-motion'` as needed.

### App-like feel

Every interface should feel like an app, not a form — even when it technically is one. The goal is a polished, native-feeling experience:

- **Desktop:** Avoid long scrolling forms. Instead, use creative layouts — cards, split panes, steppers, grouped sections that fit the viewport, tabbed views, etc. The interface should feel like a single cohesive screen, not a document you scroll through.
- **Mobile:** Scrolling may be unavoidable, but use sticky headers, fixed CTAs/submit buttons, and anchored navigation to maintain an app-like feel. The user should always know where they are and have key actions within reach.
- Think of every interface as a single-purpose tool the user opens, uses, and closes — not a web page they read.

### No layout shift

**Layout shift is never acceptable.** Elements jumping around as content loads or streams in is the fastest way to make an interface feel broken. Prevent it everywhere:

- **Reserve space** for content that hasn't arrived yet. Use fixed or min-height containers, skeleton placeholders, or aspect-ratio boxes so the layout is stable before data lands.
- **Streaming text** should flow into a container that grows downward without pushing sibling elements sideways or causing reflows above the viewport. Pin headers, sidebars, and CTAs so they stay put while content fills in.
- **Images** must always have explicit dimensions (via `width`/`height` attributes or aspect-ratio CSS) so the browser reserves space before the image loads. Never let an image pop in and shove content down.
- **Loading → loaded transitions** should swap content in-place, not change the size or position of the container. A spinner and the final content should occupy the same space.
- **Conditional UI** (e.g. elements that appear when `useIsRunning()` changes, or sections that show after a variable is populated) should be laid out so their appearance doesn't displace existing content. Use overlay/absolute positioning, reserved slots, or opacity transitions rather than inserting elements into the flow.

## Image CDN

All images (uploaded via `uploadFile` or received through template variables) are served from an image CDN that supports dynamic resizing via query parameters:

```
?fm=auto&w=400&h=300&fit=crop
```

**Parameters:**
- `fm` — Format: `auto`, `jpg`, or `png`
- `w` — Width in pixels
- `h` — Height in pixels
- `fit` — Resize mode: `crop` or `cover`
- `crop=face` — Face-detection cropping (use instead of `fit` when cropping to faces)

Always use these parameters to request appropriately sized images rather than relying on CSS scaling of full-resolution originals. This improves load times and reduces bandwidth.

## Video CDN

Videos uploaded via `uploadFile` or received through template variables are served from `videos.mindstudio-cdn.com`. Video URLs follow the pattern:

```
https://videos.mindstudio-cdn.com/{orgId}/videos/{videoId}.mp4
```

### Thumbnails

Append `/thumbnail.png` to any video URL to get a thumbnail image:

```
https://videos.mindstudio-cdn.com/{orgId}/videos/{videoId}.mp4/thumbnail.png?ts=last&w=400
```

**Parameters:**
- `ts` — Timestamp to capture: number (seconds) or `last` for the last frame. Defaults to `0`.
- All image CDN resizing parameters also work on thumbnails (`w`, `h`, `fit`, `fm`, `crop`).

### Metadata

Append `/metadata.json` to any video URL to get metadata:

```
https://videos.mindstudio-cdn.com/{orgId}/videos/{videoId}.mp4/metadata.json
```

Returns:

```typescript
type MediaMetadata = {
  kind: 'image' | 'video' | 'audio' | 'unknown';
  mimeType?: string;
  fileSizeBytes?: number;
  width?: number;
  height?: number;
  orientation: 'portrait' | 'landscape' | 'square' | 'unknown';
  aspectRatio?: string;
  durationSec?: number;
  frameRate?: number;
  hasAudio?: boolean;
};
```

## Code Conventions

- Always provide the **complete, fully rewritten** file — never partial diffs. This applies to both `src/App.tsx` and `src/OpenGraphCard.tsx`.
- Use `useTemplateVariables()` values defensively (any property may be `undefined`).
- Pre-fill form fields from `useTemplateVariables()` when values are defined.
- For Generate Asset templates: use the most structured version of data available (e.g. prefer arrays over giant strings). Guard against unexpected shapes.
- Always show loading states after calling `submit`, `next`, `approve`, or while awaiting `uploadFile`.
- When building a Generate Asset or Menu interface, also create a tailored `src/OpenGraphCard.tsx` that uses the app's key data to produce a compelling sharing image. Skip this for User Input, Revise Variable, and Workbench interfaces.
