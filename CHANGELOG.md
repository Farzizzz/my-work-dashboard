# Changelog

## 1.0.0 (2026-10-13)
First release.
- `/my-work-dashboard` skill: an interview-driven build of a private Google Apps Script dashboard,
  deployed with clasp to one fixed URL (`deploy.sh`), refreshed daily, with a snapshot per day.
- Sources (all optional): Jira Software and Service Management (queue, SLA via JSM, team share,
  involved, projects, OKRs, a permanent Done record), Slack support channels, GitHub, Gmail, Google
  Calendar, Outlook / Microsoft 365 (Graph), and custom REST sources from a fixed contract.
- Theming: presets, brand colours or custom, a logo, and light/dark/auto. Automatic WCAG contrast
  correction with a report of what changed.
- `build.mjs --check`: syntax, duplicate-name and every-tab render checks. `preview.mjs` shows sample
  data before anything is deployed.
