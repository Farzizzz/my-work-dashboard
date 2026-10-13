# Outlook / Microsoft 365 (mail + calendar)

**Shows:** the same as Gmail + Google Calendar, from Microsoft Graph. The dashboard still runs on
Google. Module: `template/sources/Outlook.gs` (built-in OAuth flow, no external library). Read-only.

## Who can do this
Someone who can **register an app in Microsoft Entra ID** (many organisations restrict this to IT),
and whose organisation allows user consent for these read-only permissions. Otherwise an admin grants
consent once. If neither is possible, skip Outlook and say why.

## Steps (after the first `clasp push`, because the redirect needs the script ID)
1. Script ID: the `scriptId` in the project's `.clasp.json`.
2. https://entra.microsoft.com ▸ App registrations ▸ **New registration**
   - Name: `My Work Dashboard (read-only)`
   - Supported accounts: *Accounts in this organizational directory only*
   - Redirect URI: platform **Web**, `https://script.google.com/macros/d/<SCRIPT_ID>/usercallback`
3. **Certificates & secrets ▸ New client secret** ▸ copy the **Value** (not the ID).
4. **API permissions ▸ Add ▸ Microsoft Graph ▸ Delegated**: `offline_access`, `User.Read`,
   `Mail.Read`, `Calendars.Read`. Add nothing else. Grant admin consent if the portal says it's required.
5. Script Properties: `OUTLOOK_CLIENT_ID` (Overview ▸ Application (client) ID),
   `OUTLOOK_CLIENT_SECRET`, `OUTLOOK_TENANT` (Overview ▸ Directory (tenant) ID).
6. Reload the Sheet ▸ **My Dashboard ▸ Connect Outlook** ▸ sign in ▸ accept ▸ close ▸ Refresh now.

Tokens are stored in the user's own User Properties and refresh automatically. Client secrets
expire (6–24 months). When one does, create a new one and update the property.

## Notes
- "Awaiting reply" ignores the *Other* (non-Focused) inbox and automated senders.
- Calendar events are read in UTC and laid onto the configured working hours.
