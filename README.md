# My Work Dashboard

A Claude Code plugin that builds you a **private dashboard of your own work**: tickets, projects,
PRs, support threads, email and meetings. It also keeps a **permanent record of everything you've
finished**, so done work doesn't vanish from your board after two weeks.

Claude interviews you about the tools you actually use and the colours you want, then builds,
deploys and schedules it in **your own Google account**. Nothing is hosted anywhere else, and only you
can open it.

## Install
```text
/plugin marketplace add Farzizzz/my-work-dashboard
/plugin install my-work-dashboard
```
Then, in any folder:
```text
/my-work-dashboard
```

## What you need
- A **Google account** (Workspace or personal). The dashboard runs on Google Apps Script with a Google Sheet.
- **Node 18+** and **clasp**. Claude checks for both and helps you install clasp.
- Accounts for whichever sources you choose. Every source is optional.

## Sources
| Source | What you see | What you create |
|---|---|---|
| **Jira** (Software / Service Management) | My queue, service-desk stats and SLA met, share of team, tickets I'm involved in, projects, OKRs, **Done record** | An Atlassian API token |
| **Slack** | Support threads I answered, my share and first-response time | A small read-only Slack app (manifest included) |
| **GitHub** | PRs opened, merged and reviewed, waiting on my review, assigned issues | A read-only fine-grained token |
| **Gmail + Google Calendar** | Emails sent, conversations waiting on me, meeting load, free time | Nothing |
| **Outlook / Microsoft 365** | The same, via Microsoft Graph | An Entra app registration (or ask IT) |
| **Anything else with an API** | Whatever you need: Claude writes the collector from the tool's API docs | A token for that tool |

## Look and feel
Pick a preset (Slate, Ocean, Forest, Sunset, Berry, Mono, High contrast), use your company's brand
colours, or choose your own. Add your logo or initials, and choose light, dark or auto. You see a
preview with sample data before anything is deployed. Colours that would be hard to read are adjusted
automatically, and Claude tells you what changed.

## Privacy and safety
- **Read-only** everywhere: it never edits, comments, sends or reacts.
- **Your tokens never go through chat.** You paste them into the script's own settings (Script Properties).
- Email is **metadata only** (sender, subject, date), never message bodies, and subjects can be hidden too.
- The web app is set to **Only myself**.

## Changing it later
Run `/my-work-dashboard` in the project folder: add or remove a source, recolour, rename.
`./deploy.sh` republishes to the **same URL** every time.

## Layout
```
skills/my-work-dashboard/
  SKILL.md            the interview + build runbook Claude follows
  references/         question bank, theming, per-source setup guides, troubleshooting
  template/           the Apps Script project (core + one module per source + custom template)
  scripts/            build.mjs · preview.mjs · theme.mjs (Node, no dependencies)
  examples/           sample answers.json files
```

## Licence
MIT © [Farz Owasil](https://github.com/Farzizzz)
