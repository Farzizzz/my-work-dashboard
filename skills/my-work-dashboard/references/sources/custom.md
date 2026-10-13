# Other systems (custom source)

For any tool with a REST API: ServiceNow, Zendesk, Freshservice, Linear, Asana, PagerDuty, HubSpot,
Confluence, Notion and so on.

## Process
1. Ask the questions in questions.md §C "Other system": the tool, its web address, what to show, and how they get a token.
2. **Check the tool's official API docs** (WebFetch or WebSearch) for: the auth scheme, the endpoint
   that lists items assigned to the current user, the field names, pagination and rate limits. Use
   **read-only** endpoints and the least-privileged token type. Don't guess, and say which doc page you used.
3. Copy `template/custom/Custom_example.gs` to `<project>/Custom_<id>.gs` (id = lowercase letters and
   digits, e.g. `zendesk`). Fill in the base URL, auth header and calls. Keep the contract:
   - `function collect_custom_<id>_()` returns `{ title, lead?, note?, headline:[{label,value,hint?,tone?}], tables:[{title, columns, rows}] }`
   - cells are text, numbers or `{ text, url }`. Prefix a column name with `#` to right-align it
   - `function test_custom_<id>()` makes one cheap authenticated call and returns `'OK - …'`
   - secrets come only from `prop_('NAME')`. Use `httpJson_()` from Common.gs (retries 429/5xx)
4. Add `{ "id": "<id>", "name": "<Tab name>", "secrets": ["NAME", …] }` to `sources.custom` in answers.json.
5. Run `build.mjs --check`. It fails if the collect function is missing or names clash.
6. The user adds the secrets as Script Properties and runs `testConnections`, then `testMyModel`.
   Iterate on the log they paste back.

Keep collectors under about a minute (paginate sensibly, cap lists at 25 rows). The overview shows the
first two `headline` items.
