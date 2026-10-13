/**
 * Author: Farz Owasil (my-work-dashboard template)
 * Slack.gs - the support threads I took part in, in the channels I chose. READ-ONLY.
 * Script Property: SLACK_TOKEN = bot token (xoxb-…) from the app manifest in the setup guide
 * (channels:history, channels:read, groups:history, groups:read, users:read, users:read.email,
 * reactions:read). Invite the bot to each channel: /invite @<bot name>.
 * My own Slack ID is looked up from my Google email, so nothing personal is hard-coded.
 */

function slackGet_(method, params) {
  const qs = Object.keys(params || {}).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
  for (var attempt = 0; attempt < 5; attempt++) {
    const b = httpJson_('https://slack.com/api/' + method + (qs ? '?' + qs : ''), { headers: { Authorization: 'Bearer ' + prop_('SLACK_TOKEN') } }, 'Slack ' + method);
    if (b.ok) return b;
    if (b.error === 'ratelimited') { Utilities.sleep(3000); continue; }
    throw new Error('Slack ' + method + ': ' + b.error + (b.error === 'not_in_channel' ? ' (invite the bot to the channel)' : ''));
  }
  throw new Error('Slack ' + method + ': still rate-limited after retries');
}

/** My Slack member ID: Script Property SLACK_USER_ID if set, else looked up by my Google email (cached). */
function slackMe_() {
  const cached = propOpt_('SLACK_USER_ID');
  if (cached) return cached;
  const u = slackGet_('users.lookupByEmail', { email: Session.getEffectiveUser().getEmail() }).user;
  PropertiesService.getScriptProperties().setProperty('SLACK_USER_ID', u.id);
  return u.id;
}

function slackHistoryAll_(channel, oldest) {
  const out = []; let cursor = null, guard = 0;
  do {
    const p = { channel: channel, oldest: oldest, limit: 200 };
    if (cursor) p.cursor = cursor;
    const b = slackGet_('conversations.history', p);
    (b.messages || []).forEach(function (m) { out.push(m); });
    cursor = b.response_metadata && b.response_metadata.next_cursor;
  } while (cursor && guard++ < 100);
  return out;
}
function slackReplies_(channel, ts) { return slackGet_('conversations.replies', { channel: channel, ts: ts, limit: 200 }).messages || []; }
function slackIsBot_(m) {
  const ignore = CONFIG.sources.slack.ignoreBotIds || [];
  return !!m.bot_id || m.subtype === 'bot_message' || ignore.indexOf(m.user) >= 0;
}
function slackIsRequest_(m) { return m.user && !m.subtype && !m.bot_id; }
function slackHasEmoji_(reactions, names) { return (reactions || []).some(function (rx) { return names.indexOf(rx.name) >= 0; }); }

/** Threads I answered: count, my share of human-answered threads, my median first response, ✅ resolved. */
function slackSection_() {
  const cfg = CONFIG.sources.slack, me = slackMe_(), days = cfg.windowDays || 14, cap = cfg.maxThreads || 400;
  const done = cfg.doneEmojis || ['white_check_mark', 'heavy_check_mark'];
  const oldest = Math.floor((Date.now() - days * 86400000) / 1000);
  let threads = 0, humanAnswered = 0, mine = 0, firstHuman = 0, myResolved = 0, started = 0, fetched = 0, capped = false;
  const ttfr = [], perChannel = [];
  (cfg.channels || []).forEach(function (ch) {
    let chMine = 0, chThreads = 0;
    slackHistoryAll_(ch.id, oldest).filter(slackIsRequest_).forEach(function (m) {
      threads++; chThreads++;
      if (m.user === me) { started++; return; }
      if (!m.reply_count) return;
      if (fetched >= cap) { capped = true; return; }
      fetched++;
      const humans = slackReplies_(ch.id, m.ts).filter(function (r) { return r.ts !== m.ts && r.user && r.user !== m.user && !slackIsBot_(r); });
      if (!humans.length) return;
      humanAnswered++;
      const myReplies = humans.filter(function (r) { return r.user === me; });
      if (!myReplies.length) return;
      mine++; chMine++;
      if (humans[0].user === me) firstHuman++;
      ttfr.push((Number(myReplies[0].ts) - Number(m.ts)) / 60);
      if (slackHasEmoji_(m.reactions, done)) myResolved++;
    });
    perChannel.push({ name: ch.name || ch.id, threads: chThreads, mine: chMine });
  });
  const med = median_(ttfr);
  return {
    windowDays: days, channels: perChannel, threads: threads, humanAnswered: humanAnswered, myThreads: mine, firstHuman: firstHuman,
    mySharePct: humanAnswered ? Math.round(mine / humanAnswered * 100) : 0,
    myTtfrMin: med == null ? null : Math.round(med * 10) / 10, myResolved: myResolved, started: started, capped: capped
  };
}

function testSlack() {
  const auth = slackGet_('auth.test', {});
  const me = slackMe_();
  const res = (CONFIG.sources.slack.channels || []).map(function (ch) {
    try { slackGet_('conversations.history', { channel: ch.id, limit: 1 }); return (ch.name || ch.id) + ' ✓'; }
    catch (e) { return (ch.name || ch.id) + ' ✗ ' + e.message; }
  });
  return 'OK - bot ' + auth.user + ' in ' + auth.team + '; you are ' + me + '; channels: ' + res.join(', ');
}
