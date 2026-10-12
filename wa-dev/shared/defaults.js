// shared by content script + popup
window.WA_DEV_DEFAULTS = {
  theme: true,
  statusBar: true,
  codeTools: true,
  stealth: false,
  autoHide: false,
  scanlines: false,
  accent: '#4dffa0',
  fontSize: 13,
  // one per line:  name = text   (\n inside text = new line)
  // expand in the composer by typing ;name then Tab
  snippets: [
    'shrug = ¯\\_(ツ)_/¯',
    'lgtm = LGTM 👍',
    'wip = WIP, will push soon',
    'pull = fixed in the latest commit, pls pull',
    'bug = repro steps:\\n1. \\n2. \\nexpected:\\nactual:',
    'sync = quick call? 5 min'
  ].join('\n')
};

window.WA_DEV_ACCENTS = {
  green: '#4dffa0',
  amber: '#ffb454',
  cyan: '#5ccfff',
  magenta: '#ff6ac1',
  red: '#ff5c6c'
};
