---
name: my-work-dashboard
description: Interview the user about the tools they use (Jira, Slack, GitHub, Gmail/Google Calendar, Outlook, or any other system with an API) and their preferred colours/branding, then build, deploy and schedule a private personal "My Work" dashboard as a Google Apps Script web app in their own Google account. Use when someone wants a personal work dashboard, a record of what they've done, a "my tickets/PRs/meetings at a glance" page, or runs /my-work-dashboard. Also use to change an existing one (add or remove a source, recolour, rename) without changing its URL.
license: MIT
metadata:
  author: Farz Owasil
  version: "1.0.0"
  domain: productivity
  triggers: my work dashboard, personal dashboard, work metrics, what have I done, accomplishments record, my tickets dashboard, Apps Script dashboard
  role: builder
  scope: end-to-end
  output-format: deployed web app + project folder
---

# My Work Dashboard

Build someone a private, self-refreshing dashboard of **their own** work. It lives in their Google
account as a Sheet + bound Apps Script, deployed with clasp as a web app only they can open. Sources
are optional modules: they only answer questions about tools they actually use.

Everything in this skill folder is referenced relative to it:
`scripts/` (Node tooling), `template/` (the Apps Script project), `references/` (question bank,
per-source setup guides, theming, troubleshooting), `examples/` (sample answers files).

## Hard rules

- **Read-only** against every source. Never write, comment, transition, send or react anywhere.
- **Secrets never pass through chat.** Tokens go straight into Script Properties by the user. If
  someone pastes a token into chat, tell them to revoke it and create a new one, and don't use it.
- **Private by default:** web app access = Only myself, execute as = me. Don't change that unless the
  user explicitly asks, and warn them that their work data would then be visible to others.
- **One deployment, fixed URL:** always publish with the project's `./deploy.sh`. Never run
  `clasp deploy` / `create-deployment` directly; it creates a new URL.
- **Confirm before outward actions:** creating the Google Sheet/script (`clasp create`) and the first
  deploy each get a clear yes from the user first.
- **Verified facts only** when writing a custom source. Read the tool's official API docs and don't
  guess endpoints or field names. If unsure, ask the user to run the `test_custom_*` function and
  paste the log.
- **Brand colours:** never invent a company's hex values. Ask for them, or propose some and get explicit
  confirmation. Run the contrast check and tell the user what was adjusted.
- Ask questions in small batches (use the AskUserQuestion tool when available; 1–4 questions per
  round). Always offer "I don't use this" or "skip". Nothing except one source is mandatory.

## Flow

### 0 · Detect mode
- If the current folder (or a folder the user names) has `answers.json` + `.clasp.json`, this is
  **change mode**: read `answers.json`, ask what they want to change, edit it, then do steps 4 and 6
  (rebuild + `./deploy.sh`). Skip everything else.
- Otherwise **new build**: continue.

### 1 · Pre-flight (stop politely if a hard requirement is missing)
1. **Google Workspace or a Google account?** The dashboard runs on Google Apps Script. If they have no
   Google account they can use, explain that and stop. Outlook/Microsoft 365 can still be a *data
   source* (step 2) as long as the dashboard itself lives in Google.
2. Check tools, running these yourself: `node --version` (needs 18+) and `clasp --version`. If clasp
   is missing, offer `npm install -g @google/clasp`. Check `clasp show-authorized-user`; if they're
   not logged in, ask them to run `clasp login` themselves (it opens a browser).
3. Ask them to switch on the Apps Script API at https://script.google.com/home/usersettings (one
   toggle). clasp fails without it.
4. Ask where to put the project folder (default `~/my-work-dashboard`).

### 2 · Interview
Follow `references/questions.md` exactly: about you → which sources → per-source questions (only
for chosen sources) → look and feel → refresh time. Write answers into `<project>/answers.json` as
you go, following the schema in that file (see `examples/answers.full.json`).

For each chosen source, open its guide in `references/sources/` for what to ask and what the user must
create (tokens, the Slack app, the Entra app). For **other systems**, follow `references/sources/custom.md`:
write `<project>/Custom_<id>.gs` from `template/custom/Custom_example.gs`.

### 3 · Look and feel
Use `references/theming.md`. Offer presets, brand colours or custom; a logo (initials, an https image
URL, or pasted SVG); and light/dark/auto. Then:
```bash
node <skill>/scripts/build.mjs <project>/answers.json <project> --check
node <skill>/scripts/preview.mjs <project>
```
Open `<project>/preview.html` for them (built-in browser or `open`). It uses sample data only.
Show both light and dark (`--dark`) if mode is auto. Repeat until they're happy, and report any
colours the contrast check changed.

### 4 · Build and check
Run `build.mjs ... --check`. It must say **check passed**. Fix any problems it lists before going on.
Summarise for the user: which sources, which tabs, the Script Properties they'll need, and the theme.
Get a yes.

### 5 · Create, connect, deploy
1. With their OK, in the project folder run
   `clasp create --type sheets --title "<their dashboard title>" --rootDir .`. clasp may write its own
   `appsscript.json`. If so, rebuild (step 4) so ours wins, then run `clasp push --force`.
2. Give them the editor link (`clasp open-script` prints it) and the exact **Script Properties** list
   from the build output. They add these themselves under Project Settings ▸ Script Properties.
   Point them to the per-source guide for how to get each value.
3. They run **`testConnections`** in the editor and accept the Google permission prompt, then copy
   the Execution log back to you. Each line shows ✓ or ✗ with the reason. Fix the ✗ lines using
   `references/troubleshooting.md`.
4. **Jira only:** they run **`discoverJira`** and paste the log. Use it to confirm project keys,
   priorities to break down by, SLA field names (JSM only), OKR labels and start/due date fields.
   Update `answers.json`, then rebuild and push.
5. **Outlook only:** they use the Sheet menu ▸ My Dashboard ▸ Connect Outlook (see the Outlook guide).
6. They run **`updateDashboard`** (or Sheet menu ▸ My Dashboard ▸ Refresh now). Ask for the Status tab
   or `testMyModel` log and check every source says OK.
7. With their OK, run `./deploy.sh "first release"`. It creates the deployment once, saves the id to
   `.deployment-id`, and prints the private URL. Give them the link.
8. They choose Sheet menu ▸ My Dashboard ▸ **Set up daily refresh** (it runs as them).

### 6 · Changes later
Edit `answers.json` (or a `Custom_*.gs`), run `build.mjs --check`, then `./deploy.sh "what changed"`.
The URL never changes. New scopes (e.g. turning Gmail on) need one re-authorisation: run any function
in the editor and accept.

## What they get (tabs appear only for enabled sources)
Overview (headline cards from every source, 14/30/60-day ranges with ▲/▼ vs the previous window) ·
Service desk + My queue (JSM) · Involved (tickets they raised/watch) · Projects + OKRs · **Done**
(a permanent record of finished work, also saved to a never-cleared *Done Log* tab) · GitHub ·
Slack · Email & calendar · one tab per custom source. There's a "Viewing" picker for any past
day's snapshot, a light/dark toggle and a Download button.

## Reference files
- `references/questions.md`: the question bank, branching and the answers.json schema
- `references/theming.md`: presets, brand colours, contrast rules, logos
- `references/sources/{jira,slack,github,google,outlook,custom}.md`: what to ask, what to create, limits
- `references/troubleshooting.md`: common errors and their fixes
