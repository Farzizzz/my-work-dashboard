/**
 * Author: Farz Owasil (my-work-dashboard template)
 * Dashboard.gs - builds the dashboard model from the enabled sources, stores one dated snapshot per
 * day, and serves the private web app. READ-ONLY against every source.
 *   updateDashboard()  - daily trigger / menu: build the model + store today's snapshot.
 *   doGet()            - web app: the latest model + a date index for the "Viewing" picker.
 */

var DASH_STORE_TAB = 'DashboardModels';   // hidden: [Date, Captured at, Model JSON chunks…]

/** The bound Sheet. getActive() works from the menu/trigger; the web app falls back to the id saved
 *  on the first run, so no Sheet id is hard-coded. */
function dashSheet_() {
  const active = SpreadsheetApp.getActive();
  if (active) {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty('DASH_SHEET_ID') !== active.getId()) props.setProperty('DASH_SHEET_ID', active.getId());
    return active;
  }
  return SpreadsheetApp.openById(prop_('DASH_SHEET_ID'));
}

/**
 * Section registry: [model path, label, collector function name, enabled?]. A collector only runs
 * when its source is enabled in CONFIG AND its module file is present. Custom sources are appended
 * from CONFIG.sources.custom (function collect_custom_<id>_). Each fails independently.
 */
function sections_() {
  const S = CONFIG.sources || {}, j = S.jira || {};
  const on = function (x) { return !!(x && x.enabled); };
  const list = [
    ['jira.helpdesk', 'Jira service desk', 'jiraHelpdesk_', on(j) && on(j.serviceDesk)],
    ['jira.queue',    'Jira queue',        'jiraQueue_',    on(j) && on(j.serviceDesk)],
    ['jira.involved', 'Jira involved',     'jiraInvolved_', on(j) && on(j.involved)],
    ['jira.projects', 'Jira projects',     'jiraProjects_', on(j) && on(j.projectWork)],
    ['jira.done',     'Jira done',         'jiraDone_',     on(j) && on(j.projectWork) && j.projectWork.doneLog !== false],
    ['slack',         'Slack',             'slackSection_', on(S.slack)],
    ['github',        'GitHub',            'githubSection_', on(S.github)],
    ['mail',          'Gmail',             'gmailSection_', on(S.gmail)],
    ['calendar',      'Google Calendar',   'gcalSection_',  on(S.gcal)],
    ['mail',          'Outlook mail',      'outlookMail_',  on(S.outlook) && S.outlook.mail !== false && !on(S.gmail)],
    ['calendar',      'Outlook calendar',  'outlookCalendar_', on(S.outlook) && S.outlook.calendar !== false && !on(S.gcal)]
  ];
  (S.custom || []).forEach(function (c) { list.push(['custom.' + c.id, c.name, 'collect_custom_' + c.id + '_', c.enabled !== false]); });
  return list.filter(function (s) { return s[3]; });
}

// ---- Web app entry ----
function doGet() {
  const sh = dashSheet_().getSheetByName(DASH_STORE_TAB);
  var current = { updated: '(no data yet - run My Dashboard ▸ Refresh now in the Sheet)' };
  var history = [];
  if (sh && sh.getLastRow() >= 2) {
    const n = sh.getLastRow() - 1, lastCol = Math.max(sh.getLastColumn(), 3);
    history = sh.getRange(2, 1, n, 1).getDisplayValues().slice(0, -1).map(function (r) { return { date: String(r[0]) }; });
    const lastRow = sh.getRange(n + 1, 1, 1, lastCol).getValues()[0];
    try { current = JSON.parse(lastRow.slice(2).join('')); current.date = String(lastRow[0]); } catch (e) {}
  }
  const b = CONFIG.brand || {};
  const t = HtmlService.createTemplateFromFile('DashboardUI');
  t.dataJson = JSON.stringify(current).replace(/</g, '\\u003c');
  t.historyJson = JSON.stringify(history);
  t.themeCss = CONFIG.themeCss || '';
  t.brandJson = JSON.stringify(b).replace(/</g, '\\u003c');
  t.logoHtml = b.logoHtml || '';
  t.titleText = b.title || 'My Work';
  return t.evaluate().setTitle(b.title || 'My Work').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Web-app callback (google.script.run): one stored day's model as a JSON string, or '' if not found.
function getSnapshotModel(date) {
  const sh = dashSheet_().getSheetByName(DASH_STORE_TAB);
  if (!sh || sh.getLastRow() < 2) return '';
  const n = sh.getLastRow() - 1, lastCol = Math.max(sh.getLastColumn(), 3);
  const dates = sh.getRange(2, 1, n, 1).getDisplayValues();
  for (var i = 0; i < n; i++) {
    if (String(dates[i][0]) === String(date)) return sh.getRange(i + 2, 1, 1, lastCol).getValues()[0].slice(2).join('');
  }
  return '';
}

// ---- Trigger entry: build + store ----
function updateDashboard() {
  const model = buildDashboardModel_();
  const ss = dashSheet_();
  let sh = ss.getSheetByName(DASH_STORE_TAB);
  if (!sh) sh = ss.insertSheet(DASH_STORE_TAB);
  if (sh.getLastRow() === 0) { sh.getRange(1, 1, 1, 3).setValues([['Date', 'Captured at', 'Model JSON']]).setFontWeight('bold'); sh.setFrozenRows(1); }
  const date = Utilities.formatDate(new Date(), CONFIG.timezone, 'yyyy-MM-dd');
  const payload = JSON.stringify(model);
  const CHUNK = 40000, chunks = [];                      // a cell caps at 50k chars
  for (var i = 0; i < payload.length; i += CHUNK) chunks.push(payload.slice(i, i + CHUNK));
  const row = [date, model.updated].concat(chunks);
  const n = sh.getLastRow() - 1;
  const dates = n > 0 ? sh.getRange(2, 1, n, 1).getDisplayValues().map(function (r) { return r[0]; }) : [];
  const idx = dates.indexOf(date);
  const wide = Math.max(sh.getLastColumn(), row.length);
  if (idx >= 0) {
    sh.getRange(idx + 2, 1, 1, wide).clearContent();
    sh.getRange(idx + 2, 1, 1, row.length).setValues([row]);
  } else {
    sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  }
  sh.hideSheet();
  writeStatusTab_(model);
  const errs = Object.keys(model.errors || {});
  ss.toast('Dashboard stored for ' + date + (errs.length ? ' - issues: ' + errs.join(', ') : ' - all sources OK'));
}

function buildDashboardModel_() {
  const model = {
    updated: Utilities.formatDate(new Date(), CONFIG.timezone, 'd MMMM yyyy, HH:mm'),
    defaultRange: String(ranges_()[0]), ranges: ranges_(), errors: {}, timings: {},
    sections: sections_().map(function (s) { return { path: s[0], label: s[1] }; })   // tabs show even if a source fails
  };
  sections_().forEach(function (s) {
    const path = s[0], label = s[1], fn = globalThis[s[2]];
    if (typeof fn !== 'function') { model.errors[label] = 'module missing (' + s[2] + ')'; return; }
    const t0 = Date.now();
    try { setPath_(model, path, fn()); }
    catch (e) { model.errors[label] = String(e.message || e).slice(0, 300); Logger.log('%s failed: %s', label, e.stack || e); }
    model.timings[label] = Math.round((Date.now() - t0) / 100) / 10;
  });
  return model;
}
function setPath_(o, path, v) { const p = path.split('.'); for (var i = 0; i < p.length - 1; i++) o = o[p[i]] = o[p[i]] || {}; o[p[p.length - 1]] = v; }

/** A small readable tab: which sources ran, how long they took, any error. */
function writeStatusTab_(m) {
  writeTable_('Status', ['Source', 'Result', 'Seconds'], sections_().map(function (s) {
    const err = (m.errors || {})[s[1]];
    return [s[1], err ? 'ERROR: ' + err : 'OK', (m.timings || {})[s[1]] || ''];
  }));
}

/** DIAGNOSTIC - build the model and log each section's size + any errors (run from the editor). */
function testMyModel() {
  const m = buildDashboardModel_();
  Logger.log('updated=%s', m.updated);
  Logger.log('errors=%s', JSON.stringify(m.errors));
  Logger.log('timings (s)=%s', JSON.stringify(m.timings));
  Object.keys(m).forEach(function (k) {
    if (['updated', 'errors', 'timings', 'ranges', 'defaultRange', 'sections'].indexOf(k) >= 0) return;
    Logger.log('%s: %s', k, JSON.stringify(m[k]).slice(0, 600));
  });
}

/** Runs every test*() function whose module is present. Safe: read-only, logs no secrets. */
function testConnections() {
  ['testJira', 'testSlack', 'testGitHub', 'testGoogle', 'testOutlook'].concat(
    (CONFIG.sources.custom || []).map(function (c) { return 'test_custom_' + c.id; })
  ).forEach(function (name) {
    if (typeof globalThis[name] !== 'function') return;
    try { Logger.log('%s → %s', name, globalThis[name]()); } catch (e) { Logger.log('%s ✗ %s', name, e.message); }
  });
}
