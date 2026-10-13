#!/usr/bin/env node
// Author: Farz Owasil (my-work-dashboard)
// build.mjs - answers.json → a ready-to-push Apps Script project.
//   node build.mjs <answers.json> <projectDir> [--check]
// Copies the core + only the enabled source modules, renders Config.gs (settings + theme, NO secrets)
// and appsscript.json (only the scopes those sources need), keeps user-written Custom_*.gs files and
// .clasp.json / .deployment-id untouched, and removes modules for sources that were switched off.
// --check: syntax-checks every .gs file and smoke-renders every tab with sample data.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildTheme, themeCss, logoHtml } from './theme.mjs';
import { smokeTest } from './render.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TPL = path.join(HERE, '..', 'template');
const SOURCE_FILES = { jira: 'Jira.gs', slack: 'Slack.gs', github: 'GitHub.gs', google: 'Google.gs', outlook: 'Outlook.gs' };
const CORE = ['Common.gs', 'Dashboard.gs', 'Main.gs', 'DashboardUI.html', 'deploy.sh', '.claspignore'];

const die = msg => { console.error('✗ ' + msg); process.exit(1); };
const arr = v => (Array.isArray(v) ? v : String(v || '').split(',')).map(x => String(x).trim()).filter(Boolean);
const on = x => !!(x && x.enabled);

export function normalise(a) {
  if (!a || typeof a !== 'object') die('answers.json is empty or not an object');
  const S = a.sources || {}, out = {};
  const tz = a.timezone || 'Europe/London';
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch { die('Unknown timezone: ' + tz); }

  if (on(S.jira)) {
    const j = S.jira;
    if (!j.site) die('Jira is enabled but sources.jira.site is empty (e.g. "yourcompany.atlassian.net")');
    const site = String(j.site).replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const sd = j.serviceDesk || {}, pw = j.projectWork || {};
    const sdProjects = arr(sd.projects).map(x => x.toUpperCase()), pwProjects = arr(pw.projects).map(x => x.toUpperCase());
    if (!sdProjects.length && !pwProjects.length) die('Jira is enabled but no projects were given (serviceDesk.projects or projectWork.projects)');
    out.jira = {
      enabled: true, site, myJql: j.myJql || 'assignee = currentUser()', excludeKeys: arr(j.excludeKeys).map(x => x.toUpperCase()),
      idleDays: +j.idleDays || 7, listCap: +j.listCap || 25,
      serviceDesk: { enabled: sdProjects.length > 0 && sd.enabled !== false, projects: sdProjects, priorities: arr(sd.priorities),
        sla: { ttfr: (sd.sla && sd.sla.ttfr) || '', ttr: (sd.sla && sd.sla.ttr) || '' }, slaTargets: sd.slaTargets || {},
        autoResolvedTypes: arr(sd.autoResolvedTypes), waitingStatuses: arr(sd.waitingStatuses || 'Waiting for customer,Pending'), teamShare: sd.teamShare !== false },
      projectWork: { enabled: pwProjects.length > 0 && pw.enabled !== false, projects: pwProjects, okrLabels: arr(pw.okrLabels),
        objectiveTypes: arr(pw.objectiveTypes || 'Epic,Initiative'), startDateFields: arr(pw.startDateFields), endDateFields: arr(pw.endDateFields), doneLog: pw.doneLog !== false },
      involved: { enabled: !j.involved || j.involved.enabled !== false, days: +(j.involved && j.involved.days) || 14 }
    };
  }
  if (on(S.slack)) {
    const ch = (S.slack.channels || []).map(c => typeof c === 'string' ? { id: c, name: c } : c).filter(c => c.id);
    if (!ch.length) die('Slack is enabled but no channels were given (need channel IDs like C0123ABCD)');
    ch.forEach(c => { if (!/^[CG][A-Z0-9]{6,}$/.test(c.id)) die('Slack channel id looks wrong: ' + c.id + ' (open the channel ▸ name ▸ About ▸ Channel ID)'); });
    out.slack = { enabled: true, channels: ch, ignoreBotIds: arr(S.slack.ignoreBotIds), doneEmojis: arr(S.slack.doneEmojis || 'white_check_mark,heavy_check_mark'),
      windowDays: +S.slack.windowDays || 14, maxThreads: +S.slack.maxThreads || 400 };
  }
  if (on(S.github)) {
    const api = S.github.apiBase || 'https://api.github.com';
    out.github = { enabled: true, apiBase: api.replace(/\/$/, ''), webBase: S.github.webBase || (api.includes('api.github.com') ? 'https://github.com' : api.replace(/\/api\/v3\/?$/, '')), orgs: arr(S.github.orgs) };
  }
  const ignore = S.ignoreSenders || 'no-?reply|notification|mailer-daemon|calendar-notification';
  if (on(S.gmail)) out.gmail = { enabled: true, ignoreSenders: S.gmail.ignoreSenders || ignore, awaitingDays: +S.gmail.awaitingDays || 14, awaitingMaxThreads: 100, storeSubjects: S.gmail.storeSubjects !== false };
  if (on(S.gcal)) out.gcal = { enabled: true };
  if (on(S.outlook)) {
    out.outlook = { enabled: true, mail: S.outlook.mail !== false && !on(S.gmail), calendar: S.outlook.calendar !== false && !on(S.gcal),
      tenant: S.outlook.tenant || 'organizations', ignoreSenders: S.outlook.ignoreSenders || ignore, awaitingDays: +S.outlook.awaitingDays || 14, storeSubjects: S.outlook.storeSubjects !== false };
    if (!out.outlook.mail && !out.outlook.calendar) die('Outlook is enabled but Gmail and Google Calendar are also on - pick one provider for mail and one for calendar');
  }
  out.custom = (S.custom || []).map(c => {
    const id = String(c.id || '').toLowerCase();
    if (!/^[a-z][a-z0-9]{1,24}$/.test(id)) die('Custom source id must be letters/digits, starting with a letter: ' + c.id);
    return { id, name: c.name || id, enabled: c.enabled !== false, secrets: arr(c.secrets) };
  });
  if (!Object.keys(out).filter(k => k !== 'custom').length && !out.custom.length) die('No sources are enabled - pick at least one');

  const theme = buildTheme(a.theme || {});
  const mode = ['light', 'dark', 'auto'].includes((a.theme || {}).mode) ? a.theme.mode : 'auto';
  const owner = a.owner || {};
  let logo; try { logo = logoHtml((a.theme || {}).logo, theme, owner.name); } catch (e) { die(e.message); }
  const config = {
    generatedFor: owner.name || '', generatedAt: new Date().toISOString().slice(0, 10), timezone: tz,
    workHours: { start: +(a.workHours && a.workHours.start) || 9, end: +(a.workHours && a.workHours.end) || 17 },
    refreshHour: Number.isInteger(+a.refreshHour) ? +a.refreshHour : 7, ranges: (a.ranges || [14, 30, 60]).map(Number),
    brand: { title: owner.title || 'My Work', subtitle: owner.subtitle || (owner.name || ''), footer: owner.footer || owner.name || '',
      logoHtml: logo.html, logoBoxed: logo.boxed, mode, jiraBrowse: out.jira ? 'https://' + out.jira.site + '/browse/' : '' },
    themeCss: themeCss(theme, mode),
    sources: out
  };
  if (config.workHours.end <= config.workHours.start) die('workHours.end must be after workHours.start');
  return { config, themeReport: theme.report };
}

function scopesFor(c) {
  const S = c.sources, needsHttp = S.jira || S.slack || S.github || S.outlook || S.custom.length;
  const sc = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/script.scriptapp',
              'https://www.googleapis.com/auth/script.container.ui', 'https://www.googleapis.com/auth/userinfo.email'];
  if (needsHttp) sc.push('https://www.googleapis.com/auth/script.external_request');
  if (S.gmail) sc.push('https://www.googleapis.com/auth/gmail.readonly');
  if (S.gcal) sc.push('https://www.googleapis.com/auth/calendar.readonly');
  return sc;
}

export function scriptProperties(c) {
  const S = c.sources, p = [];
  if (S.jira) p.push(['JIRA_EMAIL', 'your Atlassian login email'], ['JIRA_TOKEN', 'API token - id.atlassian.com ▸ Security ▸ API tokens']);
  if (S.slack) p.push(['SLACK_TOKEN', 'the bot token (xoxb-…) from the Slack app you installed']);
  if (S.github) p.push(['GITHUB_TOKEN', 'fine-grained PAT, read-only (Pull requests, Issues, Metadata)']);
  if (S.outlook) p.push(['OUTLOOK_CLIENT_ID', 'Entra app (client) ID'], ['OUTLOOK_CLIENT_SECRET', 'Entra client secret VALUE'], ['OUTLOOK_TENANT', 'optional: tenant ID (default "organizations")']);
  S.custom.forEach(x => x.secrets.forEach(s => p.push([s, 'for ' + x.name])));
  return p;
}

export function build(answersPath, dir, { check = false, quiet = false } = {}) {
  const answers = JSON.parse(fs.readFileSync(answersPath, 'utf8'));
  const { config, themeReport } = normalise(answers);
  fs.mkdirSync(dir, { recursive: true });
  const S = config.sources;
  const wanted = new Set(CORE);
  if (S.jira) wanted.add(SOURCE_FILES.jira);
  if (S.slack) wanted.add(SOURCE_FILES.slack);
  if (S.github) wanted.add(SOURCE_FILES.github);
  if (S.gmail || S.gcal) wanted.add(SOURCE_FILES.google);
  if (S.outlook) wanted.add(SOURCE_FILES.outlook);

  // Remove modules this builder owns but the user switched off (never touches Custom_*.gs or clasp files).
  Object.values(SOURCE_FILES).forEach(f => { if (!wanted.has(f) && fs.existsSync(path.join(dir, f))) fs.rmSync(path.join(dir, f)); });
  wanted.forEach(f => {
    const src = fs.existsSync(path.join(TPL, 'core', f)) ? path.join(TPL, 'core', f) : path.join(TPL, 'sources', f);
    fs.copyFileSync(src, path.join(dir, f));
  });
  fs.chmodSync(path.join(dir, 'deploy.sh'), 0o755);

  const missingCustom = S.custom.filter(c => !fs.existsSync(path.join(dir, 'Custom_' + c.id + '.gs')));
  const header = `/**\n * Config.gs - GENERATED by my-work-dashboard from answers.json on ${config.generatedAt}${config.generatedFor ? ' for ' + config.generatedFor : ''}.\n` +
    ` * Re-run the skill (or build.mjs) to change it rather than editing by hand. NO SECRETS here: tokens live in\n * Project Settings ▸ Script Properties.\n */\n`;
  fs.writeFileSync(path.join(dir, 'Config.gs'), header + 'const CONFIG = ' + JSON.stringify(config, null, 2) + ';\n');
  const manifest = { timeZone: config.timezone, exceptionLogging: 'STACKDRIVER', runtimeVersion: 'V8', oauthScopes: scopesFor(config), webapp: { access: 'MYSELF', executeAs: 'USER_DEPLOYING' } };
  if (S.gmail) manifest.dependencies = { enabledAdvancedServices: [{ userSymbol: 'Gmail', serviceId: 'gmail', version: 'v1' }] };
  fs.writeFileSync(path.join(dir, 'appsscript.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.mkdirSync(path.join(dir, '.mwd'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.mwd', 'config.json'), JSON.stringify(config, null, 2));
  if (path.resolve(answersPath) !== path.resolve(dir, 'answers.json')) fs.copyFileSync(answersPath, path.join(dir, 'answers.json'));

  const result = { dir, files: [...wanted, 'Config.gs', 'appsscript.json'], themeReport, missingCustom: missingCustom.map(c => 'Custom_' + c.id + '.gs'), props: scriptProperties(config), check: null };
  if (check) result.check = checkProject(dir, config);
  if (!quiet) report(result);
  return result;
}

export function checkProject(dir, config) {
  const problems = [];
  const gs = fs.readdirSync(dir).filter(f => f.endsWith('.gs'));
  // All .gs files share one global scope in Apps Script: check syntax together, catch duplicate names.
  const joined = gs.map(f => `// ---- ${f}\n` + fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  try { new vm.Script(joined, { filename: 'project.gs' }); } catch (e) { problems.push('syntax: ' + e.message); }
  const names = {};
  gs.forEach(f => { for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/^(?:function\s+([A-Za-z_$][\w$]*)|(?:var|const|let)\s+([A-Za-z_$][\w$]*)\s*=)/gm)) { const n = m[1] || m[2]; (names[n] = names[n] || []).push(f); } });
  Object.keys(names).forEach(n => { if (names[n].length > 1) problems.push(`"${n}" is defined in more than one file: ${names[n].join(', ')}`); });
  (config.sources.custom || []).forEach(c => { if (!new RegExp('function\\s+collect_custom_' + c.id + '_\\s*\\(').test(joined)) problems.push(`custom source "${c.id}" has no collect_custom_${c.id}_() function`); });
  let smoke = { tabs: [], problems: [] };
  try { smoke = smokeTest(dir, config); } catch (e) { problems.push('render: ' + e.message); }
  return { problems: problems.concat(smoke.problems), tabs: smoke.tabs };
}

function report(r) {
  console.log('✓ Built ' + r.dir);
  console.log('  files: ' + r.files.join(', '));
  if (r.themeReport.length) console.log('  colours adjusted for readability:\n    ' + r.themeReport.join('\n    '));
  if (r.missingCustom.length) console.log('  ⚠ custom source file(s) still to write: ' + r.missingCustom.join(', ') + ' (start from template/custom/Custom_example.gs)');
  console.log('  Script Properties to add (Project Settings ▸ Script Properties):');
  r.props.forEach(([k, why]) => console.log('    ' + k.padEnd(22) + why));
  if (r.check) {
    console.log('  tabs: ' + r.check.tabs.join(' · '));
    console.log(r.check.problems.length ? '  ✗ check problems:\n    ' + r.check.problems.join('\n    ') : '  ✓ check passed (syntax, duplicate names, every tab × range renders)');
  }
}

if (process.argv[1] && (await import('node:url')).fileURLToPath(import.meta.url) === (await import('node:path')).resolve(process.argv[1])) {
  const [answers, dir] = process.argv.slice(2).filter(x => !x.startsWith('--'));
  if (!answers || !dir) die('usage: node build.mjs <answers.json> <projectDir> [--check]');
  const r = build(answers, dir, { check: process.argv.includes('--check') });
  if (r.check && r.check.problems.length) process.exit(2);
}
