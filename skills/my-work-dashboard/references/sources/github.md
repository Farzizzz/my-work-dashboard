# GitHub

**Shows:** PRs opened, merged and reviewed (per range, with ▲/▼), PRs waiting on my review, my open
PRs, and issues assigned to me. Module: `template/sources/GitHub.gs`. Read-only (GET only).

## What the user creates
A **fine-grained personal access token**: GitHub ▸ Settings ▸ Developer settings ▸ Personal access
tokens ▸ Fine-grained tokens ▸ Generate.
- Resource owner: themselves, or their organisation (some orgs require approval for fine-grained tokens)
- Repository access: All repositories, or the ones they work in
- Permissions: **Pull requests: Read**, **Issues: Read**, **Metadata: Read** (nothing else)
- Script Property `GITHUB_TOKEN`

GitHub Enterprise Server: set `apiBase` to `https://HOST/api/v3`. If the server doesn't support
fine-grained tokens, a classic token works but `repo` scope also grants write. Warn them about that,
and prefer read-only options.

## Notes and limits
- Uses the search API (30 requests/min), so calls are spaced about 2 s apart. The section takes about 45 s.
- Counts only cover repos the token can see. `orgs` limits everything to those organisations.
- "Reviewed" = PRs by other people that they reviewed and that were updated in the window. GitHub
  search has no "reviewed on date" filter, so this is a close proxy. Say so if asked.
