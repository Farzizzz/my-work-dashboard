// Author: Farz Owasil (my-work-dashboard)
// mock.mjs - a realistic fake model for the enabled sections, so the preview and the render check
// show every tab exactly as the real one will (no real data involved).

const iso = d => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);

export function mockModel(config) {
  const S = config.sources || {}, R = config.ranges || [14, 30, 60];
  const m = { updated: 'preview · sample data', defaultRange: String(R[0]), ranges: R, errors: {}, sections: [] };
  const add = (path, label) => m.sections.push({ path, label });
  const pri = ['Highest', 'High', 'Medium', 'Low'];
  const byR = f => Object.fromEntries(R.map((d, i) => [String(d), f(d, i)]));
  const j = S.jira || {};
  if (j.enabled && j.serviceDesk && j.serviceDesk.enabled) {
    add('jira.helpdesk', 'Jira service desk'); add('jira.queue', 'Jira queue');
    const win = k => ({ logged: 12 * k, closed: 10 * k, closedHuman: 9 * k, teamClosed: 140 * k, ttfrMet: 9 * k, ttfrTot: 10 * k, ttrMet: 8 * k, ttrTot: 10 * k, avgResolveDays: 1.4,
      priorities: pri.map((p, i) => ({ p, logged: (i + 1) * k, closed: (i + 1) * k - (i ? 1 : 0), ttfrMet: (i + 1) * k, ttfrTot: (i + 1) * k + 1, ttrMet: i * k, ttrTot: (i + 1) * k })) });
    m.jira = m.jira || {};
    m.jira.helpdesk = { hasSla: !!(j.serviceDesk.sla && (j.serviceDesk.sla.ttfr || j.serviceDesk.sla.ttr)), teamShare: j.serviceDesk.teamShare !== false,
      slaTargets: j.serviceDesk.slaTargets || {}, byRange: byR((d, i) => Object.assign(win(i + 1), { prev: win(i + 1 + (i % 2 ? 1 : -0.5)) })) };
    m.jira.queue = { open: 6, waiting: 2, idle: 1, idleDays: j.idleDays || 7, byPriority: { High: 2, Medium: 3, Low: 1 }, byStatus: { 'In Progress': 3, 'Waiting for customer': 2, 'To Do': 1 },
      oldest: [{ key: 'HELP-101', title: 'Laptop will not join Wi-Fi', p: 'High', status: 'In Progress', ageDays: 9, idleDays: 8, waiting: false, idle: true },
               { key: 'HELP-117', title: 'Access to the finance shared drive', p: 'Medium', status: 'Waiting for customer', ageDays: 4, idleDays: 2, waiting: true, idle: false }] };
  }
  if (j.enabled && j.involved && j.involved.enabled) {
    add('jira.involved', 'Jira involved'); m.jira = m.jira || {};
    m.jira.involved = { days: 14, total: 2, items: [{ key: 'PLAT-88', title: 'Renew TLS certificates', status: 'In Progress', project: 'PLAT', assignee: 'Sam Lee', role: 'Watcher', updated: iso(1) },
      { key: 'HELP-95', title: 'New starter kit for design team', status: 'Done', project: 'HELP', assignee: 'Ana Ruiz', role: 'Reporter', updated: iso(3) }] };
  }
  if (j.enabled && j.projectWork && j.projectWork.enabled) {
    add('jira.projects', 'Jira projects'); m.jira = m.jira || {};
    const hasOkrs = (j.projectWork.okrLabels || []).length > 0, y = new Date().getFullYear(), q = Math.floor(new Date().getMonth() / 3) + 1;
    m.jira.projects = { hasOkrs, inflightCount: 3,
      inflight: [{ key: 'PLAT-140', title: 'Automate onboarding checklist', status: 'In Progress', type: 'Task', parent: 'PLAT-120', updated: iso(1) },
                 { key: 'PLAT-151', title: 'Document backup restore test', status: 'To Do', type: 'Task', parent: '', updated: iso(6) }],
      quarters: hasOkrs ? [{ id: y + 'Q' + q, label: String(y), q: 'Q' + q, state: 'live', summary: { objectives: 1, delivered: 0, childPct: 60, childDone: 3, childTotal: 5 },
        objectives: [{ key: 'PLAT-120', type: 'Epic', title: 'Self-service onboarding', status: 'In Progress', done: 3, total: 5, krs: [{ key: 'PLAT-121', title: 'Form live', status: 'Done' }, { key: 'PLAT-140', title: 'Checklist automation', status: 'In Progress' }] }] },
        { id: y + 'Q' + (q % 4 + 1), label: String(q === 4 ? y + 1 : y), q: 'Q' + (q % 4 + 1), state: 'soon', summary: {}, objectives: [] }] : [] };
    if (j.projectWork.doneLog !== false) {
      add('jira.done', 'Jira done');
      m.jira.done = { total: 5, cancelled: 1, items: [
        { key: 'PLAT-139', title: 'Migrate wiki to new space', type: 'Task', status: 'Done', date: iso(2), parent: 'PLAT-120', parentTitle: 'Self-service onboarding', okr: false, cancelled: false },
        { key: 'PLAT-121', title: 'Onboarding form live', type: 'Task', status: 'Done', date: iso(9), parent: 'PLAT-120', parentTitle: 'Self-service onboarding', okr: hasOkrs, cancelled: false },
        { key: 'PLAT-110', title: 'Retire legacy VPN profile', type: 'Story', status: 'Done', date: iso(35), parent: '', parentTitle: '', okr: false, cancelled: false },
        { key: 'PLAT-104', title: 'Audit shared mailbox owners', type: 'Task', status: 'Done', date: iso(70), parent: '', parentTitle: '', okr: false, cancelled: false },
        { key: 'PLAT-101', title: 'Spike: new password manager', type: 'Task', status: 'Cancelled', date: iso(80), parent: '', parentTitle: '', okr: false, cancelled: true }] };
    }
  }
  if (S.github && S.github.enabled) {
    add('github', 'GitHub');
    const it = (t, r, n, a) => ({ title: t, repo: r, number: n, url: 'https://github.com/' + r + '/pull/' + n, ageDays: a, updated: iso(a) });
    m.github = { login: 'you', byRange: byR((d, i) => ({ opened: 4 * (i + 1), merged: 3 * (i + 1), reviewed: 6 * (i + 1), prev: { opened: 3 * (i + 1), merged: 3 * (i + 1), reviewed: 4 * (i + 1) } })),
      awaitingReview: [it('Add retry to sync job', 'acme/infra', 412, 1)], myOpenPrs: [it('Terraform: tag all buckets', 'acme/infra', 409, 3)], assignedIssues: [] };
  }
  if (S.slack && S.slack.enabled) {
    add('slack', 'Slack');
    m.slack = { windowDays: S.slack.windowDays || 14, channels: (S.slack.channels || [{ name: '#help' }]).map(c => ({ name: c.name || c.id, threads: 30, mine: 6 })),
      threads: 30, humanAnswered: 22, myThreads: 6, firstHuman: 4, mySharePct: 27, myTtfrMin: 12.5, myResolved: 3, started: 1, capped: false };
  }
  const mailOn = (S.gmail && S.gmail.enabled) || (S.outlook && S.outlook.enabled && S.outlook.mail !== false);
  const calOn = (S.gcal && S.gcal.enabled) || (S.outlook && S.outlook.enabled && S.outlook.calendar !== false);
  if (mailOn) {
    const prov = S.gmail && S.gmail.enabled ? 'Gmail' : 'Outlook';
    add('mail', prov === 'Gmail' ? 'Gmail' : 'Outlook mail');
    m.mail = { provider: prov, sent: byR((d, i) => ({ cur: 20 * (i + 1), prev: 18 * (i + 1) })), awaitingDays: 14, awaitingCount: 2,
      awaiting: [{ from: 'Priya Shah', subject: 'Re: laptop refresh budget', ageDays: 3, link: 'https://example.com' }, { from: 'Tom Ng', subject: 'Quick question on access', ageDays: 1, link: '' }] };
  }
  if (calOn) {
    const prov = S.gcal && S.gcal.enabled ? 'Google Calendar' : 'Outlook calendar';
    add('calendar', prov);
    m.calendar = { provider: prov, thisWeek: { meetings: 9, meetingHours: 7.5, focusHours: 32.5, loadPct: 19 }, nextWeek: { meetings: 5, meetingHours: 4, focusHours: 36, loadPct: 10 },
      today: [{ time: '10:00–10:30', title: 'Team stand-up' }, { time: '14:00–15:00', title: 'Quarterly planning' }] };
  }
  (S.custom || []).forEach(c => {
    add('custom.' + c.id, c.name); m.custom = m.custom || {};
    m.custom[c.id] = { title: c.name, lead: 'Sample data for ' + c.name + '.', headline: [{ label: 'Open items', value: 7, tone: 'a1' }, { label: 'Closed this week', value: 12, tone: 'good' }],
      tables: [{ title: 'Oldest open', columns: ['Item', 'Status', '#Age (days)'], rows: [[{ text: 'Example item', url: 'https://example.com' }, 'Open', 5]] }] };
  });
  return m;
}
