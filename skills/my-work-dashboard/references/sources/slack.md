# Slack

**Shows:** for the chosen support channels over the last 14 days: threads I answered, my share of
threads that got a human reply, my median first-response time, threads where I was first to answer,
and ✅-resolved. My own questions are excluded. Module: `template/sources/Slack.gs`. Read-only.

## What the user creates (needs permission to install apps, or a Slack admin)
1. https://api.slack.com/apps ▸ **Create New App** ▸ **From an app manifest** ▸ pick the workspace ▸
   paste the manifest below ▸ Create ▸ **Install to Workspace**.
2. Copy **OAuth & Permissions ▸ Bot User OAuth Token** (`xoxb-…`) into Script Property `SLACK_TOKEN`.
3. In each channel: `/invite @my-work-dashboard`.

```yaml
display_information:
  name: My Work Dashboard (read-only)
  description: Reads support threads so a personal dashboard can count the ones I answered.
features:
  bot_user:
    display_name: my-work-dashboard
    always_online: false
oauth_config:
  scopes:
    bot:
      - channels:history
      - channels:read
      - groups:history
      - groups:read
      - users:read
      - users:read.email
      - reactions:read
settings:
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

Their Slack member ID is found automatically from their Google email (`users.lookupByEmail`). If
their Slack email is different, they set Script Property `SLACK_USER_ID` (Profile ▸ ⋮ ▸ Copy member ID).

## Notes and limits
- Channel IDs (not names) go in answers.json: channel ▸ name ▸ About ▸ Channel ID.
- DMs aren't read, and can't be with a bot token. That's deliberate.
- Busy channels: replies are fetched for at most `maxThreads` (400) threads, and the tab says if the cap was hit.
- Bots that post as users can be listed in `ignoreBotIds` so they don't count as people.
