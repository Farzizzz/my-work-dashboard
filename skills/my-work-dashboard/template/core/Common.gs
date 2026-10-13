/**
 * Author: Farz Owasil (my-work-dashboard template)
 * Common.gs - shared helpers: Script Properties, sheets, dates, HTTP with retry. No source logic here.
 */

/** Required Script Property (Project Settings ▸ Script Properties). Throws a clear message if missing. */
function prop_(key) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error('Missing Script Property: ' + key + ' (set it in Project Settings ▸ Script Properties)');
  return v.trim();
}
function propOpt_(key) { const v = PropertiesService.getScriptProperties().getProperty(key); return v ? v.trim() : ''; }

/** Get a tab in the dashboard Sheet by name, creating it if absent. */
function getSheet_(name) {
  const ss = dashSheet_();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

/** Overwrite a tab with a header row + rows, and stamp the update time in A1's note. */
function writeTable_(name, headers, rows) {
  const sh = getSheet_(name);
  sh.clearContents();
  sh.clearFormats();
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  if (rows && rows.length) sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sh.getRange('A1').setNote('Auto-updated ' + Utilities.formatDate(new Date(), CONFIG.timezone, 'yyyy-MM-dd HH:mm'));
}

function fmtDate_(d) { return Utilities.formatDate(d, CONFIG.timezone, 'yyyy-MM-dd'); }
function daysAgo_(n) { return new Date(Date.now() - n * 86400000); }

function median_(arr) {
  if (!arr.length) return null;
  const a = arr.slice().sort(function (x, y) { return x - y; }), i = Math.floor(a.length / 2);
  return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2;
}

function q_(arr) { return arr.map(function (x) { return '"' + String(x).replace(/"/g, '\\"') + '"'; }).join(','); }

/**
 * JSON over HTTP with retry on 429/5xx (honours Retry-After). opts = UrlFetchApp params.
 * Throws "<label> <code>: <first 200 chars>" on a non-2xx so collector errors are readable.
 */
function httpJson_(url, opts, label) {
  const o = Object.assign({ muteHttpExceptions: true }, opts || {});
  for (var attempt = 0; attempt < 5; attempt++) {
    const r = UrlFetchApp.fetch(url, o), code = r.getResponseCode();
    if (code === 429 || code >= 500) {
      const wait = parseInt((r.getHeaders() || {})['Retry-After'] || '', 10);
      Utilities.sleep((isNaN(wait) ? Math.pow(2, attempt) * 1000 : wait * 1000));
      continue;
    }
    const txt = r.getContentText();
    if (code >= 300) throw new Error((label || 'HTTP') + ' ' + code + ': ' + txt.slice(0, 200));
    return txt ? JSON.parse(txt) : {};
  }
  throw new Error((label || 'HTTP') + ': still failing after retries (rate-limited or server error)');
}

/** Short user-facing ranges used by every range-aware section (days). */
function ranges_() { return CONFIG.ranges || [14, 30, 60]; }

// ---- shared calendar maths (Google Calendar + Outlook) ----
function weekStart_(offsetWeeks) {
  const d = new Date(); const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow + offsetWeeks * 7); d.setHours(0, 0, 0, 0); return d;
}
/** spans = [{start: Date, end: Date}] - minutes inside working hours, focus = what's left. */
function weekLoad_(start, spans) {
  const wh = CONFIG.workHours || { start: 9, end: 17 };
  let mins = 0;
  spans.forEach(function (s) {
    const ws = new Date(s.start); ws.setHours(wh.start, 0, 0, 0);
    const we = new Date(s.start); we.setHours(wh.end, 0, 0, 0);
    const a = Math.max(s.start.getTime(), ws.getTime()), b = Math.min(s.end.getTime(), we.getTime());
    if (b > a) mins += (b - a) / 60000;
  });
  const capacity = 5 * (wh.end - wh.start) * 60;
  return { start: fmtDate_(start), meetings: spans.length, meetingHours: Math.round(mins / 6) / 10,
           focusHours: Math.round(Math.max(0, capacity - mins) / 6) / 10, loadPct: capacity ? Math.round(mins / capacity * 100) : 0 };
}
function todayList_(spans) {
  return spans.slice(0, 12).map(function (s) {
    return { time: Utilities.formatDate(s.start, CONFIG.timezone, 'HH:mm') + '–' + Utilities.formatDate(s.end, CONFIG.timezone, 'HH:mm'),
             title: String(s.title || '(no title)').slice(0, 80) };
  });
}
