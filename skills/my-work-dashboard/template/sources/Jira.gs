/**
 * Author: Farz Owasil (my-work-dashboard template)
 * Jira.gs - my Jira work (Jira Software and/or Jira Service Management). READ-ONLY: only
 * GET /myself, /priority, /field, /project and count/search. NEVER creates, edits, transitions or comments.
 * Script Properties: JIRA_EMAIL (Atlassian account email), JIRA_TOKEN (API token from
 * https://id.atlassian.com/manage-profile/security/api-tokens). The token is the user's own, so
 * currentUser() in JQL is them.
 * SLA attainment uses JSM's own JQL functions completed()/breached() - never reimplemented here.
 */

function jc_() { return CONFIG.sources.jira; }
function jiraAuth_() { return 'Basic ' + Utilities.base64Encode(prop_('JIRA_EMAIL') + ':' + prop_('JIRA_TOKEN')); }
function jiraUrl_(p) { return 'https://' + jc_().site.replace(/^https?:\/\//, '').replace(/\/$/, '') + p; }
function jiraGet_(path) { return httpJson_(jiraUrl_(path), { headers: { Authorization: jiraAuth_(), Accept: 'application/json' } }, 'Jira GET ' + path); }
function jiraPost_(path, body) {
  return httpJson_(jiraUrl_(path), { method: 'post', contentType: 'application/json', headers: { Authorization: jiraAuth_(), Accept: 'application/json' }, payload: JSON.stringify(body) }, 'Jira POST ' + path);
}

/** Count via the approximate-count endpoint (the classic /search is retired). */
function jiraCount_(jql) {
  try { return jiraPost_('/rest/api/3/search/approximate-count', { jql: jql }).count; }
  catch (e) { throw new Error(e.message + ' :: JQL: ' + jql); }
}
/** All matching issues (token-paginated /search/jql). */
function jiraSearch_(jql, fields) {
  const out = []; let token = null, guard = 0;
  do {
    const body = { jql: jql, maxResults: 100, fields: fields || ['key'] };
    if (token) body.nextPageToken = token;
    const j = jiraPost_('/rest/api/3/search/jql', body);
    (j.issues || []).forEach(function (x) { out.push(x); });
    token = j.nextPageToken;
  } while (token && guard++ < 50);
  return out;
}

// ---- JQL building blocks ----
function myJql_() { return '(' + (jc_().myJql || 'assignee = currentUser()') + ')'; }
function projIn_(keys) { return 'project in (' + keys.join(',') + ')'; }
function notExcluded_() { const k = jc_().excludeKeys || []; return k.length ? ' AND key not in (' + k.join(',') + ')' : ''; }
function withExclude_(jql) { const i = jql.search(/ ORDER BY /i); return i < 0 ? jql + notExcluded_() : jql.slice(0, i) + notExcluded_() + jql.slice(i); }
function isDoneStatus_(i) { const sc = i.fields.status && i.fields.status.statusCategory; return !!sc && (sc.key === 'done' || sc.name === 'Done'); }
function slaMetTotal_(baseJql, slaName) {
  const completed = jiraCount_(baseJql + ' AND "' + slaName + '" = completed()');
  const breached  = jiraCount_(baseJql + ' AND "' + slaName + '" = breached()');
  return { met: Math.max(0, completed - breached), total: completed };
}
/** Priority names to break down by: configured list, else every priority the site defines. */
function jiraPriorities_() {
  const cfg = jc_().serviceDesk.priorities || [];
  if (cfg.length) return cfg;
  return (jiraGet_('/rest/api/3/priority') || []).map(function (p) { return p.name; }).slice(0, 8);
}

// ---------------------------------------------------------------- service desk (JSM)

/** My service-desk numbers per range + the previous equal window (for ▲/▼ deltas). */
function jiraHelpdesk_() {
  const sd = jc_().serviceDesk, P = projIn_(sd.projects), ME = myJql_(), now = Date.now();
  const tf = (sd.sla || {}).ttfr, tr = (sd.sla || {}).ttr, pri = jiraPriorities_();
  const auto = sd.autoResolvedTypes || [];
  const human = auto.length ? ' AND issuetype not in (' + q_(auto) + ')' : '';
  const maxD = Math.max.apply(null, ranges_());
  const resolved = jiraSearch_(P + ' AND ' + ME + ' AND resolutiondate >= -' + maxD + 'd', ['created', 'resolutiondate', 'issuetype']);
  const sla = function (base, name) { return name ? slaMetTotal_(base, name) : { met: null, total: null }; };

  const window = function (base) {
    const f = sla(base, tf), t = sla(base, tr);
    return {
      logged: jiraCount_(base), ttfrMet: f.met, ttfrTot: f.total, ttrMet: t.met, ttrTot: t.total,
      priorities: pri.map(function (name) {
        const pb = base + ' AND priority = "' + name + '"', pf = sla(pb, tf), pt = sla(pb, tr);
        return { p: name, logged: jiraCount_(pb), closed: jiraCount_(pb + ' AND statusCategory = Done'),
                 ttfrMet: pf.met, ttfrTot: pf.total, ttrMet: pt.met, ttrTot: pt.total };
      })
    };
  };

  const out = { hasSla: !!(tf || tr), slaTargets: sd.slaTargets || {}, teamShare: sd.teamShare !== false, byRange: {} };
  ranges_().forEach(function (d) {
    const cur = window(P + ' AND ' + ME + ' AND created >= -' + d + 'd');
    const prv = window(P + ' AND ' + ME + ' AND created >= -' + (2 * d) + 'd AND created < -' + d + 'd');
    const curR = ' AND resolutiondate >= -' + d + 'd', prvR = ' AND resolutiondate >= -' + (2 * d) + 'd AND resolutiondate < -' + d + 'd';
    cur.closed = jiraCount_(P + ' AND ' + ME + curR);
    prv.closed = jiraCount_(P + ' AND ' + ME + prvR);
    if (out.teamShare) {
      cur.closedHuman = jiraCount_(P + ' AND ' + ME + curR + human); cur.teamClosed = jiraCount_(P + curR + human);
      prv.closedHuman = jiraCount_(P + ' AND ' + ME + prvR + human); prv.teamClosed = jiraCount_(P + prvR + human);
    }
    const cutoff = now - d * 86400000; let sum = 0, n = 0;
    resolved.forEach(function (i) {
      const rd = Date.parse(i.fields.resolutiondate); if (isNaN(rd) || rd < cutoff) return;
      if (auto.indexOf(i.fields.issuetype && i.fields.issuetype.name) >= 0) return;
      const cr = Date.parse(i.fields.created); if (isNaN(cr)) return;
      const days = (rd - cr) / 86400000; if (days >= 0) { sum += days; n++; }
    });
    cur.avgResolveDays = n ? Math.round(sum / n * 100) / 100 : null;
    cur.prev = prv;
    out.byRange[String(d)] = cur;
  });
  return out;
}

/** My open service-desk tickets: by priority/status, oldest first, waiting / gone-quiet flags. */
function jiraQueue_() {
  const c = jc_(), sd = c.serviceDesk, now = Date.now(), idleDays = c.idleDays || 7;
  const waitingSt = (sd.waitingStatuses || []).map(function (s) { return s.toLowerCase(); });
  const open = jiraSearch_(withExclude_(projIn_(sd.projects) + ' AND ' + myJql_() + ' AND statusCategory != Done ORDER BY created ASC'),
    ['summary', 'status', 'priority', 'created', 'updated', 'issuetype']);
  const byPriority = {}, byStatus = {};
  let waiting = 0, idle = 0;
  const rows = open.map(function (i) {
    const f = i.fields, p = (f.priority && f.priority.name) || 'None', s = (f.status && f.status.name) || '–';
    const age = Math.floor((now - Date.parse(f.created)) / 86400000), quiet = Math.floor((now - Date.parse(f.updated)) / 86400000);
    byPriority[p] = (byPriority[p] || 0) + 1; byStatus[s] = (byStatus[s] || 0) + 1;
    const isWaiting = waitingSt.indexOf(s.toLowerCase()) >= 0; if (isWaiting) waiting++;
    const isIdle = quiet >= idleDays && !isWaiting; if (isIdle) idle++;
    return { key: i.key, title: String(f.summary || '').slice(0, 120), p: p, status: s, ageDays: age, idleDays: quiet, waiting: isWaiting, idle: isIdle };
  });
  return { open: open.length, waiting: waiting, idle: idle, idleDays: idleDays, byPriority: byPriority, byStatus: byStatus,
           oldest: rows.slice(0, c.listCap || 25) };
}

/** Tickets I raised or watch but don't own, with recent activity (commenting makes you a watcher). */
function jiraInvolved_() {
  const c = jc_(), days = (c.involved && c.involved.days) || 14;
  const jql = '(reporter = currentUser() OR issue in watchedIssues()) AND (NOT ' + myJql_() + ' OR assignee is EMPTY) AND updated >= -' + days + 'd ORDER BY updated DESC';
  const hits = jiraSearch_(withExclude_(jql), ['summary', 'status', 'assignee', 'reporter', 'updated', 'project']);
  const myId = jiraGet_('/rest/api/3/myself').accountId;
  return {
    days: days, total: hits.length,
    items: hits.slice(0, c.listCap || 25).map(function (i) {
      const f = i.fields;
      return { key: i.key, title: String(f.summary || '').slice(0, 120), status: (f.status && f.status.name) || '–',
               project: (f.project && f.project.key) || '', assignee: (f.assignee && f.assignee.displayName) || 'Unassigned',
               role: (f.reporter && f.reporter.accountId === myId) ? 'Reporter' : 'Watcher', updated: String(f.updated || '').slice(0, 10) };
    })
  };
}

// ---------------------------------------------------------------- project work (Jira Software)

function jiraProjects_() {
  const pw = jc_().projectWork, P = projIn_(pw.projects), L = pw.okrLabels || [];
  const notOkr = L.length ? ' AND (labels is EMPTY OR labels not in (' + q_(L) + '))' : '';
  const inflight = jiraSearch_(withExclude_(P + ' AND ' + myJql_() + ' AND statusCategory != Done' + notOkr + ' ORDER BY updated DESC'),
    ['summary', 'status', 'issuetype', 'updated', 'parent']);
  return {
    hasOkrs: L.length > 0,
    quarters: L.length ? jiraOkrModel_() : [],
    inflightCount: inflight.length,
    inflight: inflight.slice(0, jc_().listCap || 25).map(function (i) {
      const f = i.fields;
      return { key: i.key, title: String(f.summary || '').slice(0, 120), status: (f.status && f.status.name) || '–',
               type: (f.issuetype && f.issuetype.name) || '', parent: (f.parent && f.parent.key) || '', updated: String(f.updated || '').slice(0, 10) };
    })
  };
}

// OKR quarter helpers.
function currentQuarter_() { const n = new Date(); return { y: n.getFullYear(), q: Math.floor(n.getMonth() / 3) + 1 }; }
function qIndex_(y, q) { return y * 4 + (q - 1); }
function idxToQ_(i) { return { y: Math.floor(i / 4), q: (i % 4) + 1 }; }
function qOfDate_(s) { if (!s) return null; const y = +String(s).slice(0, 4), m = +String(s).slice(5, 7); if (!y || !m) return null; return { y: y, q: Math.floor((m - 1) / 3) + 1 }; }
function firstField_(o, keys) { for (var i = 0; i < keys.length; i++) { if (o.fields[keys[i]]) return o.fields[keys[i]]; } return null; }
function childrenOf_(key) {
  let ch = jiraSearch_('parent = ' + key + notExcluded_(), ['status', 'summary']);
  if (!ch.length) { try { ch = jiraSearch_('"Epic Link" = ' + key + notExcluded_(), ['status', 'summary']); } catch (e) { ch = []; } }
  return ch;
}

/** My OKR-labelled objectives, bucketed into the quarter(s) their Start–Due dates span. */
function jiraOkrModel_() {
  const pw = jc_().projectWork, sf = pw.startDateFields || [], ef = pw.endDateFields || [];
  const T = pw.objectiveTypes && pw.objectiveTypes.length ? ' AND issuetype in (' + q_(pw.objectiveTypes) + ')' : '';
  const cq = currentQuarter_(), cqi = qIndex_(cq.y, cq.q), MAXSPAN = 8;
  const objs = jiraSearch_(projIn_(pw.projects) + ' AND ' + myJql_() + ' AND labels in (' + q_(pw.okrLabels) + ')' + T + notExcluded_(),
    ['summary', 'status', 'issuetype', 'resolutiondate', 'duedate'].concat(sf).concat(ef));
  const buckets = {};
  const bucket = function (idx) { return buckets[idx] || (buckets[idx] = { idx: idx, objectives: [] }); };
  objs.forEach(function (o) {
    const sQ = qOfDate_(firstField_(o, sf)), eQ = qOfDate_(o.fields.duedate || firstField_(o, ef) || o.fields.resolutiondate);
    let idxs, noDates = false;
    if (sQ && eQ) { idxs = []; const a = qIndex_(sQ.y, sQ.q), b = Math.min(qIndex_(eQ.y, eQ.q), a + MAXSPAN - 1); for (var i = a; i <= b; i++) idxs.push(i); }
    else if (eQ) idxs = [qIndex_(eQ.y, eQ.q)];
    else if (sQ) idxs = [qIndex_(sQ.y, sQ.q)];
    else { idxs = [cqi]; noDates = true; }
    const kids = childrenOf_(o.key), done = kids.filter(isDoneStatus_).length;
    const rec = { key: o.key, type: (o.fields.issuetype && o.fields.issuetype.name) || '', title: String(o.fields.summary || '').slice(0, 140),
      status: (o.fields.status && o.fields.status.name) || '–', done: kids.length ? done : null, total: kids.length || null, noDates: noDates,
      krs: kids.slice(0, 12).map(function (k) { return { key: k.key, title: String(k.fields.summary || '').slice(0, 120), status: (k.fields.status && k.fields.status.name) || '–' }; }) };
    idxs.forEach(function (idx) { bucket(idx).objectives.push(rec); });
  });
  [cqi, cqi + 1].forEach(bucket);
  return Object.keys(buckets).map(function (k) { return buckets[k]; }).sort(function (a, b) { return a.idx - b.idx; }).map(function (b) {
    let cd = 0, ct = 0, delivered = 0;
    b.objectives.forEach(function (o) { if (o.status === 'Done') delivered++; if (o.total) { cd += o.done; ct += o.total; } });
    const qq = idxToQ_(b.idx);
    return { id: qq.y + 'Q' + qq.q, label: String(qq.y), q: 'Q' + qq.q,
      state: b.idx < cqi ? 'past' : (b.idx === cqi ? 'live' : (b.objectives.length ? 'future' : 'soon')),
      summary: { objectives: b.objectives.length, delivered: delivered, childPct: ct ? Math.round(cd / ct * 100) : 0, childDone: cd, childTotal: ct },
      objectives: b.objectives };
  });
}

// ---------------------------------------------------------------- done record (never forgets)

var DONE_LOG_TAB = 'Done Log';
var DONE_LOG_HEAD = ['Key', 'Summary', 'Type', 'Status', 'Done date', 'Parent', 'Parent summary', 'Labels', 'First recorded'];

/**
 * Everything I've finished in the project-work projects, kept as a permanent record. Boards hide Done
 * items quickly but Jira keeps them, so each run pulls all of them and upserts into a 'Done Log' tab
 * that is never cleared: rows survive later reassignment, moves or archiving. excludeKeys are dropped.
 * Cancelled / won't-do / duplicate items stay in the log but are flagged so they don't count.
 */
function jiraDone_() {
  const pw = jc_().projectWork, today = fmtDate_(new Date()), L = (pw.okrLabels || []).map(function (x) { return x.toLowerCase(); });
  const hits = jiraSearch_(withExclude_(projIn_(pw.projects) + ' AND ' + myJql_() + ' AND statusCategory = Done ORDER BY statusCategoryChangedDate DESC'),
    ['summary', 'issuetype', 'status', 'resolutiondate', 'statuscategorychangedate', 'parent', 'labels']);
  const sh = getSheet_(DONE_LOG_TAB);
  if (sh.getLastRow() === 0) { sh.getRange(1, 1, 1, DONE_LOG_HEAD.length).setValues([DONE_LOG_HEAD]).setFontWeight('bold'); sh.setFrozenRows(1); }
  const n = Math.max(sh.getLastRow() - 1, 0);
  const byKey = {};
  (n ? sh.getRange(2, 1, n, DONE_LOG_HEAD.length).getDisplayValues() : []).forEach(function (r) { byKey[r[0]] = r; });
  hits.forEach(function (i) {
    const f = i.fields, par = f.parent || {}, prev = byKey[i.key];
    byKey[i.key] = [i.key, String(f.summary || '').slice(0, 200), (f.issuetype && f.issuetype.name) || '', (f.status && f.status.name) || '',
      String(f.resolutiondate || f.statuscategorychangedate || '').slice(0, 10), par.key || '',
      String((par.fields && par.fields.summary) || '').slice(0, 140), (f.labels || []).join(', '), prev ? prev[8] : today];
  });
  const ex = jc_().excludeKeys || [];
  const all = Object.keys(byKey).filter(function (k) { return k && ex.indexOf(k) < 0; }).map(function (k) { return byKey[k]; })
    .sort(function (a, b) { return a[4] < b[4] ? 1 : (a[4] > b[4] ? -1 : 0); });
  if (n) sh.getRange(2, 1, n, DONE_LOG_HEAD.length).clearContent();
  if (all.length) sh.getRange(2, 1, all.length, DONE_LOG_HEAD.length).setNumberFormat('@').setValues(all);
  const notDone = /cancel|won.?t|duplicate|declined|rejected/i;
  const isOkr = function (labels) { return L.length && String(labels).toLowerCase().split(/,\s*/).some(function (x) { return L.indexOf(x) >= 0; }); };
  return {
    total: all.filter(function (r) { return !notDone.test(r[3]); }).length,
    cancelled: all.filter(function (r) { return notDone.test(r[3]); }).length,
    items: all.map(function (r) { return { key: r[0], title: r[1], type: r[2], status: r[3], date: r[4], parent: r[5], parentTitle: r[6], okr: !!isOkr(r[7]), cancelled: notDone.test(r[3]) }; })
  };
}

// ---------------------------------------------------------------- setup diagnostics

/** Verify credentials. Logs who you are; never logs the token. */
function testJira() {
  const me = jiraGet_('/rest/api/3/myself');
  return 'OK - signed in to ' + jc_().site + ' as ' + me.displayName;
}

/**
 * SETUP HELPER - logs non-secret facts the setup needs: your projects, priorities, statuses and any
 * JSM SLA fields. Copy the Executions log back into Claude to finish configuring.
 */
function discoverJira() {
  Logger.log('== Signed in as: %s', jiraGet_('/rest/api/3/myself').displayName);
  const projects = jiraGet_('/rest/api/3/project/search?maxResults=100&orderBy=-lastIssueUpdatedTime');
  Logger.log('== Projects (key | name | type), most recently active first:');
  (projects.values || []).slice(0, 60).forEach(function (p) { Logger.log('  %s | %s | %s', p.key, p.name, p.projectTypeKey); });
  Logger.log('== Priorities: %s', (jiraGet_('/rest/api/3/priority') || []).map(function (p) { return p.name; }).join(' · '));
  const fields = jiraGet_('/rest/api/3/field') || [];
  const slas = fields.filter(function (f) { return f.schema && /sd-sla-field|servicelevelagreement/i.test(f.schema.custom || ''); });
  Logger.log('== JSM SLA fields (use the NAME in setup): %s', slas.length ? slas.map(function (f) { return '"' + f.name + '"'; }).join(' · ') : 'none found (not a JSM site, or no SLAs)');
  const dates = fields.filter(function (f) { return f.schema && f.schema.type === 'date' && /start|target|end|due/i.test(f.name); });
  Logger.log('== Date fields that might hold OKR start/end: %s', dates.map(function (f) { return f.name + ' = ' + f.id; }).join(' · ') || 'none');
  try {
    const mine = jiraSearch_(myJql_() + ' AND updated >= -90d', ['project', 'status', 'labels']);
    const per = {}, st = {}, lab = {};
    mine.forEach(function (i) {
      const k = i.fields.project && i.fields.project.key; per[k] = (per[k] || 0) + 1;
      const s = i.fields.status && i.fields.status.name; st[s] = (st[s] || 0) + 1;
      (i.fields.labels || []).forEach(function (l) { lab[l] = (lab[l] || 0) + 1; });
    });
    Logger.log('== Where YOUR issues live (last 90d): %s', JSON.stringify(per));
    Logger.log('== Statuses on your issues: %s', JSON.stringify(st));
    Logger.log('== Labels on your issues: %s', JSON.stringify(lab));
  } catch (e) { Logger.log('== Could not sample your issues: %s', e.message); }
  toast_('Done - open Extensions ▸ Apps Script ▸ Executions to copy the log');
}
