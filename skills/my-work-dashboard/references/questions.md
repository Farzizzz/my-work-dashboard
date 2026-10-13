# Question bank

Ask in this order, in small batches. Only ask a source's questions if they picked that source.
Defaults are in brackets, so "press enter" style answers are fine. Record everything in
`answers.json` (schema at the bottom).

## A · About you (one batch)
1. **Your name** as it should appear on the dashboard. This is also used for the initials logo.
2. **Dashboard title** [My Work] and **subtitle** [your name · team], e.g. "Platform team".
3. **Timezone** [take it from their machine with `date +%Z` / ask]. Use an IANA name like `Europe/London`.
4. **Working hours** [09:00–17:00]. Used for meeting load and free time.
5. **Daily refresh hour** [7, i.e. ~07:00 in their timezone]. The data is a snapshot from this time each day.

## B · Which sources? (multi-select; at least one)
- Jira (Jira Software and/or Jira Service Management)
- Slack (support or help channels you answer in)
- GitHub (PRs, reviews, issues)
- Email + calendar: **Gmail + Google Calendar**, or **Outlook / Microsoft 365**, or neither.
  Choose only one provider for mail and one for calendar.
- Other system with an API (ServiceNow, Zendesk, Linear, Asana, PagerDuty, Freshservice, HubSpot…)

If they only pick email and calendar, that's fine. The dashboard still works.

## C · Per source

### Jira → `references/sources/jira.md`
1. **Site** (e.g. `yourcompany.atlassian.net`).
2. **How to recognise your work** [`assignee = currentUser()`]. Offer alternatives such as
   `assignee = currentUser() OR "Team[Team]" = …` only if they ask.
3. **Do you work tickets in a service desk (JSM)?** If yes: the project key(s), and whether to show
   their **share of the team's resolved tickets** [yes]. SLA names, priorities and auto-resolved
   types to exclude come later from `discoverJira`, so don't ask for them now.
4. **Project work** (Jira Software): which project key(s) hold the projects or tasks you're assigned?
   Do you tag OKRs with a label (e.g. `OKR`)? Leave it blank if not.
5. **Done record** [yes]: keep a permanent list of everything you've finished in those projects?
6. **Involved** [yes]: show tickets you raised or watch but don't own?
7. Any issue keys to always hide (archived duplicates etc.)? [none]

### Slack → `references/sources/slack.md`
1. Which channel(s) do you help people in? Ask for the name **and Channel ID** (channel name ▸
   About ▸ Channel ID, starting with C or G).
2. Can you (or a Slack admin) create a small read-only app from a manifest? If not, skip Slack and
   explain why.
3. Any bots that reply in those channels and shouldn't count as a person? [none]

### GitHub → `references/sources/github.md`
1. github.com or GitHub Enterprise Server? For GHE, ask for the API base (`https://HOST/api/v3`).
2. Limit to particular organisations? [no limit]

### Gmail / Google Calendar → `references/sources/google.md`
1. Mail, calendar, or both? Nothing else is needed, because Google asks for permission on first run.

### Outlook / Microsoft 365 → `references/sources/outlook.md`
1. Mail, calendar, or both?
2. Can you register an app in Microsoft Entra (Azure AD)? Or is there an IT admin who can, and who
   can grant consent if your organisation requires it? If neither, skip Outlook.

### Other system → `references/sources/custom.md`
1. Which tool, and its web address (e.g. `yourco.zendesk.com`)?
2. What should the tab show? e.g. "open tickets assigned to me, oldest first, plus how many I closed this week".
3. How do you get an API token there? (Claude checks the tool's API docs and gives exact steps.)

## D · Look and feel → `references/theming.md`
1. **Colours:** a preset (Slate, Ocean, Forest, Sunset, Berry, Mono, High contrast), **your company's
   brand colours** (they give the hex codes or point to their brand page; never guess them), or custom.
2. **Logo:** your initials [default], an image URL (https), pasted SVG, or none.
3. **Light, dark or auto** (follows your device, with a toggle) [auto].
Then show the preview and iterate.

## E · Confirm
Read back a short summary: sources and tabs, the Script Properties they'll need to create, colours,
refresh time, and the folder. Get a yes before building or creating anything in their Google account.

---

## answers.json schema
```jsonc
{
  "owner": { "name": "Alex Morgan", "title": "My Work", "subtitle": "Alex Morgan · Platform", "footer": "Alex Morgan" },
  "timezone": "Europe/London",
  "workHours": { "start": 9, "end": 17 },
  "refreshHour": 7,
  "ranges": [14, 30, 60],                       // optional
  "sources": {
    "jira": {
      "enabled": true,
      "site": "yourcompany.atlassian.net",
      "myJql": "assignee = currentUser()",
      "excludeKeys": [],
      "idleDays": 7,
      "serviceDesk": {                            // omit or [] projects = off
        "projects": ["HELP"],
        "priorities": [],                         // [] = all site priorities (max 8)
        "sla": { "ttfr": "", "ttr": "" },         // JSM SLA field NAMES from discoverJira; "" = no SLA panel
        "slaTargets": { "High": { "ttfr": "30m", "ttr": "4h" } },  // display labels only
        "autoResolvedTypes": [],                  // issue types closed by automation, excluded from share/avg
        "waitingStatuses": ["Waiting for customer", "Pending"],
        "teamShare": true
      },
      "projectWork": {                            // omit or [] projects = off
        "projects": ["PLAT"],
        "okrLabels": [],                          // [] = no OKR section
        "objectiveTypes": ["Epic", "Initiative"],
        "startDateFields": [], "endDateFields": [],  // customfield ids from discoverJira; due date is used first
        "doneLog": true
      },
      "involved": { "enabled": true, "days": 14 }
    },
    "slack":   { "enabled": true, "channels": [{ "id": "C0123ABCD", "name": "#it-help" }], "ignoreBotIds": [], "windowDays": 14 },
    "github":  { "enabled": true, "apiBase": "https://api.github.com", "orgs": [] },
    "gmail":   { "enabled": true, "awaitingDays": 14 },
    "gcal":    { "enabled": true },
    "outlook": { "enabled": false, "mail": true, "calendar": true, "tenant": "organizations" },
    "ignoreSenders": "no-?reply|notification|mailer-daemon",   // regex, shared by Gmail/Outlook
    "custom":  [{ "id": "zendesk", "name": "Zendesk", "secrets": ["ZENDESK_EMAIL", "ZENDESK_TOKEN"] }]
  },
  "theme": {
    "preset": "ocean",                            // or omit and give colors
    "colors": { "primary": "#0369a1", "accent1": "", "accent2": "", "accent3": "", "head1": "", "head2": "" },
    "mode": "auto",                               // light | dark | auto
    "logo": { "type": "monogram" }                // monogram | url (value=https://…) | svg (value=<svg…>) | none
  }
}
```
Never put tokens in answers.json. Secrets only ever go in Script Properties.
