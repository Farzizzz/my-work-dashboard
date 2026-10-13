/**
 * Author: Farz Owasil (my-work-dashboard template)
 * Custom_<id>.gs - TEMPLATE for "other systems". Claude copies this, renames <id>, and fills in the
 * API calls for the user's tool from that tool's official API docs. Keep it READ-ONLY (GET / search
 * endpoints only). The secret goes in a Script Property, never in code.
 *
 * Contract - the function name MUST be collect_custom_<id>_ and it returns:
 *   { title, lead?, note?,
 *     headline: [{ label, value, hint?, tone? }],        // shown on Overview (first 2) and on the tab
 *     tables:   [{ title, columns: ['Name', '#Count'],  // '#' prefix = right-aligned number column
 *                  rows: [[ 'text' | 123 | { text, url } , ... ]] }] }
 * tone = primary | a1 | a2 | a3 | good | warn | bad
 * Register it in Config.gs ▸ CONFIG.sources.custom: [{ id: '<id>', name: 'Tab name' }]
 * (build.mjs does this from answers.json) and add test_custom_<id>() for "Test connections".
 */

var EXAMPLE_BASE = 'https://api.example.com/v1';      // ← the tool's API base URL

function exampleGet_(path) {
  return httpJson_(EXAMPLE_BASE + path, {
    headers: { Authorization: 'Bearer ' + prop_('EXAMPLE_TOKEN'), Accept: 'application/json' }   // ← auth per the tool's docs
  }, 'Example ' + path.split('?')[0]);
}

function collect_custom_example_() {
  const open = exampleGet_('/tickets?assignee=me&status=open').items || [];          // ← real endpoint
  return {
    title: 'Example tool',
    lead: 'Open items assigned to me.',
    headline: [{ label: 'Open items', value: open.length, tone: 'primary' }],
    tables: [{ title: 'Oldest open', columns: ['Item', 'Status', '#Age (days)'],
      rows: open.slice(0, 25).map(function (t) {
        return [{ text: t.title, url: t.url }, t.status, Math.floor((Date.now() - Date.parse(t.created_at)) / 86400000)];
      }) }]
  };
}

function test_custom_example() { exampleGet_('/me'); return 'OK - Example API reachable'; }
