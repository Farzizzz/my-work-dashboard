# Jira (Software + Service Management)

**Shows:** the Service desk tab (my tickets per range, closure, SLA met if JSM, share of the team,
average time to resolve), My queue (open, waiting, gone quiet), Involved (raised or watched, not mine),
Projects + OKRs, and **Done** (a permanent record of everything finished, mirrored to a *Done Log*
Sheet tab that is never cleared). Module: `template/sources/Jira.gs`. Read-only.

## What the user creates
An **API token**: https://id.atlassian.com/manage-profile/security/api-tokens ▸ **Create API token**
(the plain one, *not* "with scopes", because scoped tokens need a different API host). Script Properties:
- `JIRA_EMAIL`: the email they log in to Atlassian with
- `JIRA_TOKEN`: the token

The token acts as them, so `currentUser()` means them and they only see what they can already see.

## After the first push
They run **`discoverJira`** and paste the log. Use it to fill in:
- `serviceDesk.priorities`: the priority names worth breaking down by (leave [] for all)
- `serviceDesk.sla.ttfr` / `.ttr`: the **exact** JSM SLA field names listed (only if they use SLAs)
- `serviceDesk.autoResolvedTypes`: issue types closed by automation that would skew share or average
  (ask: "do any ticket types close themselves automatically?")
- `projectWork.okrLabels`: from "Labels on your issues"
- `projectWork.startDateFields`/`endDateFields`: customfield ids of any Start/Target date fields (due date is used first)
- `waitingStatuses`: from "Statuses on your issues"
Then rebuild and push.

## Notes and limits
- SLA % uses JSM's own `completed()` / `breached()` JQL functions, so the maths is never reimplemented.
  % is hidden below 5 tickets (met/total shown instead).
- Counts use `/rest/api/3/search/approximate-count`; lists use `/rest/api/3/search/jql`.
- The Service desk section makes roughly (priorities × 6 + 10) × 3 ranges calls. With 8 priorities that's
  about 175 calls, roughly 1–2 minutes. Fine on the daily trigger (30-min limit). If "Refresh now"
  from the menu times out (6-min limit), trim `priorities`.
- Archived issues can still match JQL by key. Put them in `excludeKeys` to hide them everywhere,
  including the Done record.
- Team share needs permission to see the whole project. If they can't, set `teamShare: false`.
