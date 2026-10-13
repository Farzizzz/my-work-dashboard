// Author: Farz Owasil (my-work-dashboard)
// render.mjs - renders the Apps Script HTML template outside Apps Script (for preview + checks), and
// runs a headless smoke test of every tab × range against a minimal fake DOM.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { mockModel } from './mock.mjs';

const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Same semantics as HtmlService: <?!= x ?> raw, <?= x ?> escaped. */
export function renderTemplate(html, vars) {
  return html.replace(/<\?(!?)=\s*(\w+)\s*\?>/g, (_, raw, name) => {
    if (!(name in vars)) throw new Error('Template variable missing: ' + name);
    return raw ? String(vars[name]) : escHtml(vars[name]);
  });
}

export function templateVars(config, model) {
  const b = config.brand || {};
  return {
    dataJson: JSON.stringify(model).replace(/</g, '\\u003c'), historyJson: '[]',
    themeCss: config.themeCss || '', brandJson: JSON.stringify(b).replace(/</g, '\\u003c'),
    logoHtml: b.logoHtml || '', titleText: b.title || 'My Work'
  };
}

/** Run the page's script against a fake DOM; visit every tab at every range. Returns problems[]. */
export function smokeTest(projectDir, config) {
  const html = fs.readFileSync(path.join(projectDir, 'DashboardUI.html'), 'utf8');
  const model = mockModel(config);
  const page = renderTemplate(html, templateVars(config, model));
  const scripts = [...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  const json = id => { const m = page.match(new RegExp('<script id="' + id + '" type="application/json">([\\s\\S]*?)</script>')); return m ? m[1] : ''; };
  for (const id of ['dash-data', 'dash-history', 'dash-brand']) JSON.parse(json(id));     // must be valid JSON
  const code = scripts.map(m => m[1]).filter(s => !/^\s*[\[{]/.test(s)).pop();
  const els = {}, problems = [];
  const el = id => els[id] || (els[id] = { id, innerHTML: '', value: '', style: {}, dataset: {}, disabled: false,
    textContent: id === 'dash-data' ? json('dash-data') : id === 'dash-history' ? json('dash-history') : id === 'dash-brand' ? json('dash-brand') : '',
    classList: { add() {}, remove() {}, toggle() {} }, querySelectorAll: () => [], setAttribute() {}, getAttribute: () => null });
  const ctx = {
    document: { getElementById: el, querySelectorAll: () => [], documentElement: { outerHTML: '', setAttribute() {}, getAttribute: () => null }, body: { appendChild() {} }, createElement: () => ({ click() {}, remove() {} }) },
    window: {}, localStorage: { getItem: () => null, setItem() {} }, matchMedia: () => ({ matches: false }), console, Date, JSON, Math, String, Number, Object, Array, RegExp, isNaN, parseInt, URL, Blob: function () {}, setTimeout
  };
  vm.createContext(ctx);
  vm.runInContext(code + '\n;this.__tabs = tabs; this.__show = showTab; this.__setRange = function(r){ RANGE = r; };', ctx);
  const tabs = ctx.__tabs();
  for (const t of tabs) for (const r of (model.ranges || [14]).map(String)) {
    try {
      ctx.__setRange(r); ctx.__show(t.id);
      const out = el('mainview').innerHTML;
      if (!out || out.length < 40) problems.push(`tab ${t.id} @${r}d rendered almost nothing`);
      if (/undefined|NaN|\[object Object\]/.test(out.replace(/<[^>]+>/g, ' '))) problems.push(`tab ${t.id} @${r}d shows "undefined", "NaN" or "[object Object]"`);
    } catch (e) { problems.push(`tab ${t.id} @${r}d threw: ${e.message}`); }
  }
  return { tabs: tabs.map(t => t.name), problems };
}
