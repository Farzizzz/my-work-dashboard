/**
 * Author: Farz Owasil (my-work-dashboard template)
 * Outlook.gs - Outlook / Microsoft 365 mail (metadata only) and calendar via Microsoft Graph.
 * READ-ONLY (delegated scopes: offline_access User.Read Mail.Read Calendars.Read).
 *
 * Needs a Microsoft Entra app registration (see the setup guide):
 *   Platform = Web, Redirect URI = https://script.google.com/macros/d/<SCRIPT_ID>/usercallback
 *   Script Properties: OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, OUTLOOK_TENANT (tenant id or
 *   'organizations'). Then Sheet menu ▸ My Dashboard ▸ Connect Outlook, sign in, accept.
 * Tokens are kept in YOUR User Properties (not shared with anyone else who can edit the script).
 * If your organisation blocks user consent, an admin must grant consent for the app once.
 */

var OUTLOOK_SCOPES = 'offline_access User.Read Mail.Read Calendars.Read';
function olTenant_() { return propOpt_('OUTLOOK_TENANT') || (CONFIG.sources.outlook && CONFIG.sources.outlook.tenant) || 'organizations'; }
function olRedirect_() { return 'https://script.google.com/macros/d/' + ScriptApp.getScriptId() + '/usercallback'; }
function olTokenUrl_() { return 'https://login.microsoftonline.com/' + olTenant_() + '/oauth2/v2.0/token'; }
function olStore_() { return PropertiesService.getUserProperties(); }

/** Menu: shows a sign-in link. After consent Microsoft redirects to outlookAuthCallback. */
function connectOutlook() {
  const state = ScriptApp.newStateToken().withMethod('outlookAuthCallback').withTimeout(3600).createToken();
  const url = 'https://login.microsoftonline.com/' + olTenant_() + '/oauth2/v2.0/authorize?client_id=' + encodeURIComponent(prop_('OUTLOOK_CLIENT_ID')) +
    '&response_type=code&response_mode=query&redirect_uri=' + encodeURIComponent(olRedirect_()) +
    '&scope=' + encodeURIComponent(OUTLOOK_SCOPES) + '&state=' + encodeURIComponent(state);
  const html = HtmlService.createHtmlOutput('<p style="font-family:sans-serif">1. <a href="' + url + '" target="_blank">Sign in to Microsoft</a> and accept read-only access.<br>2. Close this box, then run <b>Refresh now</b>.</p>' +
    '<p style="font-family:sans-serif;color:#666;font-size:12px">Redirect URI registered in Entra must be exactly:<br><code>' + olRedirect_() + '</code></p>').setWidth(520).setHeight(200);
  SpreadsheetApp.getUi().showModalDialog(html, 'Connect Outlook');
}

/** OAuth redirect target (must stay public - no trailing underscore). */
function outlookAuthCallback(request) {
  const p = request.parameter || {};
  if (p.error) return HtmlService.createHtmlOutput('Microsoft sign-in failed: ' + String(p.error_description || p.error).replace(/</g, '&lt;'));
  const tok = olTokenRequest_({ grant_type: 'authorization_code', code: p.code, redirect_uri: olRedirect_() });
  return HtmlService.createHtmlOutput(tok ? '<p style="font-family:sans-serif">✅ Outlook connected. You can close this tab.</p>' : 'Token exchange failed - check the Executions log.');
}

function olTokenRequest_(extra) {
  const payload = Object.assign({ client_id: prop_('OUTLOOK_CLIENT_ID'), client_secret: prop_('OUTLOOK_CLIENT_SECRET'), scope: OUTLOOK_SCOPES }, extra);
  const r = UrlFetchApp.fetch(olTokenUrl_(), { method: 'post', payload: payload, muteHttpExceptions: true });
  const j = JSON.parse(r.getContentText() || '{}');
  if (r.getResponseCode() >= 300 || !j.access_token) { Logger.log('Outlook token error %s: %s', r.getResponseCode(), (j.error_description || j.error || '').slice(0, 300)); return null; }
  olStore_().setProperties({ OL_ACCESS: j.access_token, OL_REFRESH: j.refresh_token || olStore_().getProperty('OL_REFRESH') || '', OL_EXPIRES: String(Date.now() + (j.expires_in - 120) * 1000) });
  return j.access_token;
}

function olAccess_() {
  const s = olStore_();
  if (s.getProperty('OL_ACCESS') && Number(s.getProperty('OL_EXPIRES')) > Date.now()) return s.getProperty('OL_ACCESS');
  const refresh = s.getProperty('OL_REFRESH');
  if (!refresh) throw new Error('Outlook not connected - Sheet menu ▸ My Dashboard ▸ Connect Outlook');
  const t = olTokenRequest_({ grant_type: 'refresh_token', refresh_token: refresh });
  if (!t) throw new Error('Outlook token refresh failed - reconnect via the Sheet menu');
  return t;
}

function disconnectOutlook() { ['OL_ACCESS', 'OL_REFRESH', 'OL_EXPIRES'].forEach(function (k) { olStore_().deleteProperty(k); }); toast_('Outlook disconnected'); }

function graph_(path, headers) {
  const url = /^https:/.test(path) ? path : 'https://graph.microsoft.com/v1.0' + path;
  return httpJson_(url, { headers: Object.assign({ Authorization: 'Bearer ' + olAccess_(), Accept: 'application/json' }, headers || {}) }, 'Graph ' + path.split('?')[0].slice(0, 60));
}
function graphAll_(path, headers, maxPages) {
  const out = []; let next = path, n = 0;
  while (next && n++ < (maxPages || 5)) { const j = graph_(next, headers); (j.value || []).forEach(function (v) { out.push(v); }); next = j['@odata.nextLink']; }
  return out;
}
function isoAgo_(days) { return new Date(Date.now() - days * 86400000).toISOString(); }

function olSentCount_(fromIso, toIso) {
  const f = 'sentDateTime ge ' + fromIso + (toIso ? ' and sentDateTime lt ' + toIso : '');
  return graph_("/me/mailFolders('SentItems')/messages?$count=true&$top=1&$select=id&$filter=" + encodeURIComponent(f), { ConsistencyLevel: 'eventual' })['@odata.count'] || 0;
}

/** Same shape as gmailSection_: sent per range + inbox conversations where the last word isn't mine. */
function outlookMail_() {
  const cfg = CONFIG.sources.outlook, ignore = new RegExp(cfg.ignoreSenders || 'no-?reply|notification|mailer-daemon', 'i');
  const sent = {};
  ranges_().forEach(function (d) { sent[String(d)] = { cur: olSentCount_(isoAgo_(d)), prev: olSentCount_(isoAgo_(2 * d), isoAgo_(d)) }; });
  const days = cfg.awaitingDays || 14, since = isoAgo_(days);
  const inbox = graphAll_("/me/mailFolders('Inbox')/messages?$top=100&$orderby=receivedDateTime desc&$select=from,subject,receivedDateTime,conversationId,webLink,inferenceClassification&$filter=" + encodeURIComponent('receivedDateTime ge ' + since), null, 2);
  const mine = graphAll_("/me/mailFolders('SentItems')/messages?$top=200&$select=conversationId,sentDateTime&$filter=" + encodeURIComponent('sentDateTime ge ' + since), null, 3);
  const lastSent = {};
  mine.forEach(function (m) { const t = Date.parse(m.sentDateTime); if (!lastSent[m.conversationId] || t > lastSent[m.conversationId]) lastSent[m.conversationId] = t; });
  const seen = {}, awaiting = [];
  inbox.forEach(function (m) {                               // newest first, so the first per conversation is its latest
    if (seen[m.conversationId]) return; seen[m.conversationId] = 1;
    if (m.inferenceClassification === 'other') return;       // skip "Other" (non-Focused) mail
    const addr = ((m.from || {}).emailAddress || {}), from = (addr.name || '') + ' ' + (addr.address || '');
    if (ignore.test(from)) return;
    const rt = Date.parse(m.receivedDateTime);
    if (lastSent[m.conversationId] && lastSent[m.conversationId] > rt) return;
    awaiting.push({ from: String(addr.name || addr.address || '').slice(0, 60), subject: cfg.storeSubjects === false ? '(subject hidden)' : String(m.subject || '').slice(0, 90),
                    ageDays: Math.floor((Date.now() - rt) / 86400000), link: m.webLink });
  });
  awaiting.sort(function (x, y) { return y.ageDays - x.ageDays; });
  return { provider: 'Outlook', sent: sent, awaitingDays: days, awaitingCount: awaiting.length, awaiting: awaiting.slice(0, 25) };
}

/** Same shape as gcalSection_. */
function outlookCalendar_() {
  const view = function (start, end) {
    return graphAll_('/me/calendarView?startDateTime=' + start.toISOString() + '&endDateTime=' + end.toISOString() +
      '&$top=200&$select=subject,start,end,isAllDay,isCancelled,responseStatus,attendees', { Prefer: 'outlook.timezone="UTC"' }, 3)
      .filter(function (e) { return !e.isAllDay && !e.isCancelled && (e.responseStatus || {}).response !== 'declined' && (e.attendees || []).length > 0; })
      .map(function (e) { return { start: new Date(e.start.dateTime + 'Z'), end: new Date(e.end.dateTime + 'Z'), title: e.subject }; });
  };
  const week = function (offset) { const s = weekStart_(offset), e = new Date(s); e.setDate(s.getDate() + 5); return weekLoad_(s, view(s, e)); };
  const now = new Date(), eod = new Date(now); eod.setHours(23, 59, 59, 0);
  return { provider: 'Outlook calendar', thisWeek: week(0), nextWeek: week(1), today: todayList_(view(now, eod)) };
}

function testOutlook() {
  const me = graph_('/me?$select=displayName,mail');
  return 'OK - Microsoft Graph as ' + me.displayName + ' (' + (me.mail || 'no mailbox') + ')';
}
