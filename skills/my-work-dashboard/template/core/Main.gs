/**
 * Author: Farz Owasil (my-work-dashboard template)
 * Main.gs - Sheet menu and the daily trigger.
 */

function onOpen() {
  const S = CONFIG.sources || {};
  const m = SpreadsheetApp.getUi().createMenu('My Dashboard')
    .addItem('Refresh now', 'updateDashboard')
    .addItem('Test connections (see Executions log)', 'testConnections')
    .addSeparator()
    .addItem('Set up daily refresh', 'setupTriggers')
    .addItem('Remove daily refresh', 'removeMyTriggers');
  if (S.jira && S.jira.enabled) m.addSeparator().addItem('Discover Jira fields (for setup)', 'discoverJira');
  if (S.outlook && S.outlook.enabled) m.addSeparator().addItem('Connect Outlook', 'connectOutlook').addItem('Disconnect Outlook', 'disconnectOutlook');
  m.addToUi();
}

/** One daily time-trigger at CONFIG.refreshHour (script timezone). Re-run safely. */
function setupTriggers() {
  removeMyTriggers(true);
  ScriptApp.newTrigger('updateDashboard').timeBased().atHour(CONFIG.refreshHour || 7).everyDays(1).inTimezone(CONFIG.timezone).create();
  toast_('Daily refresh set for ~' + (CONFIG.refreshHour || 7) + ':00 ' + CONFIG.timezone + ', running as ' + Session.getEffectiveUser().getEmail());
}

function removeMyTriggers(quiet) {
  let n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'updateDashboard') { ScriptApp.deleteTrigger(t); n++; }
  });
  if (quiet !== true) toast_('Removed ' + n + ' daily refresh trigger(s)');
}

function toast_(msg) { try { SpreadsheetApp.getActive().toast(msg); } catch (e) { Logger.log(msg); } }
