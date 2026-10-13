# Troubleshooting

| Symptom | Cause → fix |
|---|---|
| `clasp`: "User has not enabled the Apps Script API" | Turn it on at https://script.google.com/home/usersettings, wait a minute, retry |
| `clasp create` overwrote `appsscript.json` | Expected. Re-run `build.mjs` (ours wins), then `clasp push --force` |
| `clasp create` refuses because the folder isn't empty, or a `.clasp.json` exists | Create in an empty temp folder, move its `.clasp.json` into the project, and delete the temp folder |
| "Missing Script Property: X" | Add it under Project Settings ▸ Script Properties (exact name, no quotes or spaces) |
| Jira 401 | Wrong email/token pair, or a *scoped* API token. Create a plain API token |
| Jira 400 with a JQL error | A project key, SLA field name or label in answers.json doesn't exist. Run `discoverJira` and correct it |
| Jira SLA shows n/a | Not a JSM project, SLA field names blank, or none completed in the window |
| Slack `not_in_channel` | `/invite @my-work-dashboard` in that channel |
| Slack `missing_scope` | The app was made without the full manifest. Add the scope, then **reinstall** the app and copy the new token |
| Slack `users_not_found` | Their Slack email differs from Google. Set Script Property `SLACK_USER_ID` |
| GitHub 401/403 | Token expired, missing read permissions, or org approval pending for a fine-grained token |
| GitHub 422 | `orgs` contains a name that doesn't exist or the token can't see |
| Outlook "AADSTS50011 redirect URI mismatch" | The Entra redirect must be exactly `https://script.google.com/macros/d/<SCRIPT_ID>/usercallback` |
| Outlook "AADSTS65001 / needs admin approval" | The organisation blocks user consent, so an admin grants consent for the app once |
| Outlook "not connected" after weeks | The client secret expired or was revoked. Create a new secret, update the property, Connect again |
| "Exceeded maximum execution time" from **Refresh now** | Menu runs stop at 6 min (the trigger has 30). Trim Jira `priorities`, Slack `maxThreads`, or let the daily trigger run it |
| "Authorization is required" after adding a source | New scopes. Open the editor, run any function, accept |
| Web app shows "(no data yet…)" | Run Refresh now once. The page reads the stored snapshot, it doesn't fetch live |
| Web app shows old code | You pushed without deploying. Run `./deploy.sh` |
| A tab shows "Couldn't refresh: …" | That source failed on the last run while the rest still worked. The message is the API's error, so fix it and Refresh now |
| URL changed | Someone ran `clasp deploy` directly. Put the original id back in `.deployment-id` and use `./deploy.sh` from now on |
