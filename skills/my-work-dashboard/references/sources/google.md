# Gmail + Google Calendar

**Shows:** emails sent per range (▲/▼), inbox conversations where the last message isn't theirs
(automated senders filtered), meetings and meeting hours this week and next, free time inside working
hours, and today's meetings. Module: `template/sources/Google.gs`. Read-only.

## What the user creates
Nothing. The script runs as them. On first run Google asks them to allow "read your email
metadata" (`gmail.readonly`) and "see your calendars" (`calendar.readonly`).

## Privacy
Only headers are read (From, Subject, dates), never message bodies. Subjects of conversations awaiting a
reply are stored in their own private Sheet. If they'd rather not store subjects, set
`"storeSubjects": false` on `gmail` (or `outlook`) in answers.json. The list then shows sender and age only.

## Notes
- "Meeting" = a timed event with at least one other guest, not declined. Focus blocks don't count.
- `ignoreSenders` (regex) filters out notification-type senders from "awaiting reply".
