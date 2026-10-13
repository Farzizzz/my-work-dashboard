/**
 * Author: Farz Owasil (my-work-dashboard template)
 * Google.gs - Gmail (metadata only: no message bodies are read or stored) and Google Calendar.
 * No token needed: the script runs as you. Scopes: gmail.readonly, calendar.readonly. READ-ONLY.
 */

function gmailCount_(q) {
  let n = 0, token = null, guard = 0;
  do {
    const r = Gmail.Users.Messages.list('me', { q: q, maxResults: 500, pageToken: token || undefined });
    n += (r.messages || []).length; token = r.nextPageToken;
  } while (token && guard++ < 40);
  return n;
}

/** Sent volume per range (+ previous window) and inbox threads where someone is waiting on me. */
function gmailSection_() {
  const cfg = CONFIG.sources.gmail, me = Session.getEffectiveUser().getEmail().toLowerCase();
  const ignore = new RegExp(cfg.ignoreSenders || 'no-?reply|notification|mailer-daemon', 'i');
  const nowS = Math.floor(Date.now() / 1000), sent = {};
  ranges_().forEach(function (d) {
    const a = nowS - d * 86400, b = nowS - 2 * d * 86400;
    sent[String(d)] = { cur: gmailCount_('in:sent after:' + a), prev: gmailCount_('in:sent after:' + b + ' before:' + a) };
  });
  const days = cfg.awaitingDays || 14;
  const q = 'in:inbox newer_than:' + days + 'd -category:promotions -category:social -category:updates -category:forums';
  const list = Gmail.Users.Threads.list('me', { q: q, maxResults: cfg.awaitingMaxThreads || 100 }).threads || [];
  const awaiting = [];
  list.forEach(function (t) {
    const th = Gmail.Users.Threads.get('me', t.id, { format: 'metadata', metadataHeaders: ['From', 'Subject'] });
    const msgs = th.messages || []; if (!msgs.length) return;
    const last = msgs[msgs.length - 1];
    const hdr = function (m, name) { const h = (m.payload.headers || []).filter(function (x) { return x.name === name; })[0]; return h ? h.value : ''; };
    const from = hdr(last, 'From');
    if (from.toLowerCase().indexOf(me) >= 0 || ignore.test(from)) return;
    awaiting.push({ from: from.replace(/<.*>/, '').replace(/"/g, '').trim().slice(0, 60) || from.slice(0, 60),
      subject: cfg.storeSubjects === false ? '(subject hidden)' : hdr(msgs[0], 'Subject').slice(0, 90), ageDays: Math.floor((Date.now() - Number(last.internalDate)) / 86400000),
      link: 'https://mail.google.com/mail/u/0/#inbox/' + t.id });
  });
  awaiting.sort(function (x, y) { return y.ageDays - x.ageDays; });
  return { provider: 'Gmail', sent: sent, awaitingDays: days, awaitingCount: awaiting.length, awaiting: awaiting.slice(0, 25) };
}

/** Meeting load this week and next (Mon–Fri, inside working hours) and today's meetings. */
function gcalSection_() {
  const cal = CalendarApp.getDefaultCalendar();
  const isMeeting = function (e) {
    if (e.isAllDayEvent() || e.getMyStatus() === CalendarApp.GuestStatus.NO) return false;
    return e.getGuestList(true).length > 1;                 // more than just me = a meeting, not a focus block
  };
  const toSpan = function (e) { return { start: e.getStartTime(), end: e.getEndTime(), title: e.getTitle() }; };
  const week = function (offset) {
    const start = weekStart_(offset), end = new Date(start); end.setDate(start.getDate() + 5);
    return weekLoad_(start, cal.getEvents(start, end).filter(isMeeting).map(toSpan));
  };
  const now = new Date(), eod = new Date(now); eod.setHours(23, 59, 59, 0);
  return { provider: 'Google Calendar', thisWeek: week(0), nextWeek: week(1), today: todayList_(cal.getEvents(now, eod).filter(isMeeting).map(toSpan)) };
}

function testGoogle() {
  const out = [];
  if (CONFIG.sources.gmail && CONFIG.sources.gmail.enabled) out.push('Gmail ✓ (' + gmailCount_('in:sent newer_than:7d') + ' sent in 7d)');
  if (CONFIG.sources.gcal && CONFIG.sources.gcal.enabled) out.push('Calendar ✓ (' + CalendarApp.getDefaultCalendar().getName() + ')');
  return out.join('; ') || 'Google sources not enabled';
}
