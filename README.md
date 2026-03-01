# MindStudio SPA Scaffold

A Vite + React + TypeScript project for building custom interfaces in MindStudio. Interfaces run inside the MindStudio platform (in a sandboxed iframe) and talk to the host workflow via a bridge API.

The only files you edit are **`src/App.tsx`** and **`src/OpenGraphCard.tsx`**. Everything else is pre-configured.

## Local Development with Claude Code

The fastest way to build a custom interface is to clone this repo locally and use Claude Code to edit `src/App.tsx`, with changes syncing live to MindStudio.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed globally (`npm install -g @anthropic-ai/claude-code`)
- A MindStudio API key
- The app, workflow, and step IDs for the interface you're editing (shown in MindStudio when you enable local editing)

### Step-by-step setup

**1. Clone the repo and install dependencies:**

```bash
git clone <this-repo-url> my-interface
cd my-interface
npm install
```

**2. Start local dev mode:**

```bash
npm run dev:local -- --key <api-key> --app <appId> --workflow <workflowId> --step <stepId>
```

You can also set `MINDSTUDIO_API_KEY` as an environment variable instead of passing `--key`.

This fetches the current interface files from MindStudio, writes them to disk (if your local files are empty), and starts watching for changes. You'll see:

```
  ⚡ MindStudio Local Dev

  ➜  Editing:   App.tsx, OpenGraphCard.tsx
  ➜  Synced:    remote → local

  Changes push to MindStudio automatically.
  Press Ctrl+C to stop.
```

**3. Open Claude Code in the project:**

```bash
claude
```

Claude Code will read the `CLAUDE.md` file in this repo and automatically understand the project structure, the bridge API, design guidelines, and the constraint that only `src/App.tsx` and `src/OpenGraphCard.tsx` should be edited. Just tell it what interface you want to build.

### How local dev mode works

- **First run** pulls the remote files to your machine so you have a starting point.
- **After that, your local files are the source of truth.** Any changes you (or Claude Code) make are automatically pushed to MindStudio via the API.
- The file watcher uses a 200ms stability threshold, so rapid saves (common with Claude Code) are batched into a single sync.

### Tips

- **Only edit `src/App.tsx` and `src/OpenGraphCard.tsx`.** Everything else is pre-configured. Claude Code already knows this from `CLAUDE.md`.
- **Packages auto-install.** Just `import` a package in your code and it will be installed automatically.
- The `--step` parameter identifies which interface step in your workflow to sync. MindStudio will show you the correct step ID when you enable local editing.
