/**
 * Author: Farz Owasil (my-work-dashboard template)
 * GitHub.gs - my pull requests, reviews and issues. READ-ONLY (GET only).
 * Script Property: GITHUB_TOKEN = a fine-grained personal access token with read-only access
 * (Pull requests: Read, Issues: Read, Metadata: Read) to the repos you want counted.
 * Works with github.com or GitHub Enterprise Server (CONFIG.sources.github.apiBase).
 * Search API limit is 30 requests/min, so calls are paced (~2s apart).
 */

function ghc_() { return CONFIG.sources.github; }
function ghGet_(path) {
  return httpJson_(String(ghc_().apiBase || 'https://api.github.com').replace(/\/$/, '') + path, {
    headers: { Authorization: 'Bearer ' + prop_('GITHUB_TOKEN'), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  }, 'GitHub ' + path.split('?')[0]);
}
function ghLogin_() { const c = propOpt_('GITHUB_LOGIN'); if (c) return c; const l = ghGet_('/user').login; PropertiesService.getScriptProperties().setProperty('GITHUB_LOGIN', l); return l; }
function ghScope_() { const o = ghc_().orgs || []; return o.length ? ' ' + o.map(function (x) { return 'org:' + x; }).join(' ') : ''; }
var GH_LAST_SEARCH_ = 0;
function ghSearch_(q, perPage) {
  const wait = 2100 - (Date.now() - GH_LAST_SEARCH_); if (wait > 0) Utilities.sleep(wait);
  GH_LAST_SEARCH_ = Date.now();
  return ghGet_('/search/issues?per_page=' + (perPage || 1) + '&q=' + encodeURIComponent(q + ghScope_()));
}
function ghCount_(q) { return ghSearch_(q, 1).total_count; }
function ghDate_(daysBack) { return Utilities.formatDate(daysAgo_(daysBack), 'UTC', 'yyyy-MM-dd'); }
function ghItems_(q) {
  return (ghSearch_(q, 25).items || []).map(function (i) {
    const repo = String(i.repository_url || '').split('/').slice(-2).join('/');
    return { title: String(i.title || '').slice(0, 120), repo: repo, number: i.number, url: i.html_url,
             ageDays: Math.floor((Date.now() - Date.parse(i.created_at)) / 86400000), updated: String(i.updated_at || '').slice(0, 10) };
  });
}

function githubSection_() {
  const me = ghLogin_(), byRange = {};
  ranges_().forEach(function (d) {
    const cur = ghDate_(d), prv = ghDate_(2 * d);
    const span = function (field) { return { cur: field + ':>=' + cur, prev: field + ':' + prv + '..' + ghDate_(d + 1) }; };
    const o = span('created'), m = span('merged'), r = span('updated');
    byRange[String(d)] = {
      opened: ghCount_('is:pr author:' + me + ' ' + o.cur), merged: ghCount_('is:pr author:' + me + ' is:merged ' + m.cur),
      reviewed: ghCount_('is:pr reviewed-by:' + me + ' -author:' + me + ' ' + r.cur),
      prev: { opened: ghCount_('is:pr author:' + me + ' ' + o.prev), merged: ghCount_('is:pr author:' + me + ' is:merged ' + m.prev),
              reviewed: ghCount_('is:pr reviewed-by:' + me + ' -author:' + me + ' ' + r.prev) }
    };
  });
  const awaiting = ghItems_('is:pr is:open review-requested:' + me + ' archived:false');
  const myOpen = ghItems_('is:pr is:open author:' + me + ' archived:false');
  const issues = ghItems_('is:issue is:open assignee:' + me + ' archived:false');
  return { login: me, webBase: ghc_().webBase || 'https://github.com', byRange: byRange,
           awaitingReview: awaiting, myOpenPrs: myOpen, assignedIssues: issues };
}

function testGitHub() {
  const me = ghGet_('/user');
  return 'OK - signed in as ' + me.login + (ghScope_() ? ' (scoped to' + ghScope_() + ')' : '');
}
