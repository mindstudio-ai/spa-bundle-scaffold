# MindStudio SPA Scaffold

A Vite + React + TypeScript project for building custom interfaces in MindStudio. Interfaces run inside the MindStudio platform (in a sandboxed iframe) and talk to the host workflow via a bridge API.

The only file you edit is **`src/App.tsx`**. Everything else is pre-configured.

## Local Development with Claude Code

The fastest way to build a custom interface is to clone this repo locally and use Claude Code to edit `src/App.tsx`, with changes syncing live to your MindStudio sandbox.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed globally (`npm install -g @anthropic-ai/claude-code`)
- A running MindStudio sandbox with a custom interface step (you'll need its WebSocket URL)

### Step-by-step setup

**1. Clone the repo and install dependencies:**

```bash
git clone <this-repo-url> my-interface
cd my-interface
npm install
```

**2. Get your sandbox WebSocket URL from MindStudio.** It will look something like:

```
https://<sandbox-host>:4387/remy
```

**3. Start local dev mode:**

```bash
npm run dev:local -- https://<sandbox-host>:4387/remy
```

This connects to your remote sandbox, pulls the current `src/App.tsx`, and starts watching for local changes. You'll see output like:

```
[local-dev] Connected. Requesting sync...
[local-dev] Received App.tsx from remote.
[local-dev] Wrote src/App.tsx. Starting file watcher...
[local-dev] Local dev mode active.
[local-dev] Edit src/App.tsx in your IDE — changes sync to the remote sandbox automatically.
[local-dev] Use the remote sandbox preview URL to see your changes.
```

**4. Open Claude Code in the project:**

```bash
claude
```

Claude Code will read the `CLAUDE.md` file in this repo and automatically understand the project structure, the bridge API, design guidelines, and the constraint that only `src/App.tsx` should be edited. Just tell it what interface you want to build.

**5. Preview your changes** using the remote sandbox preview URL in MindStudio (not localhost).

### How local dev mode works

- **First connection** pulls the remote `src/App.tsx` to your machine so you have a starting point.
- **After that, your local file is the source of truth.** Any changes you (or Claude Code) make to `src/App.tsx` are automatically pushed to the remote sandbox.
- **Remote patches from the MindStudio IDE are ignored** while you're connected locally. This prevents the IDE from overwriting your local work.
- **If the connection drops** (network blip, sandbox restart, etc.), the client automatically reconnects with exponential backoff and pushes your local file back to the remote. No work is lost.
- The file watcher uses a 200ms stability threshold, so rapid saves (common with Claude Code) are batched into a single sync.

### Tips

- **There is no local preview.** The Vite dev server runs on the remote sandbox. Use the sandbox preview URL.
- **Packages auto-install.** Just `import` a package in your code and the remote sandbox will install it automatically.
- **Only edit `src/App.tsx`.** Everything else is pre-configured. Claude Code already knows this from `CLAUDE.md`.
