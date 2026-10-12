// shared by content scripts + popup
window.DD_DEFAULTS = {
  theme: true,          // terminal skin
  statusBar: true,      // tmux-style bottom bar
  monoFont: true,       // monospace everywhere
  squareAvatars: true,  // avatars + server icons lose the circle mask
  hideMembers: false,   // right-hand member list
  hideNitro: true,      // Nitro / Shop / Quests entries + gift button
  hideActivity: true,   // "Active Now" column
  hideGifs: false,      // GIF + sticker buttons in the composer
  stealth: false,       // blur messages until hover (alt+b)
  autoHide: false,      // blur everything when the tab loses focus
  scanlines: false,
  accent: '#4dffa0',
  // one per line:  name = text   (\n inside text = new line)
  // expand in the composer by typing ;name then Tab
  snippets: [
    'shrug = ¯\\_(ツ)_/¯',
    'lgtm = LGTM 👍',
    'bug = **repro**\\n1. \\n2. \\n**expected**\\n**actual**',
    'pr = PR is up, review when you can',
    'logs = can you share the logs / stack trace?',
    'ty = thanks!'
  ].join('\n')
};

window.DD_ACCENTS = {
  green: '#4dffa0',
  amber: '#ffb454',
  cyan: '#5ccfff',
  magenta: '#ff6ac1',
  red: '#ff5c6c'
};

// setting -> token in <html data-dd="...">  (the "dd-" prefix is stripped)
window.DD_FLAG_CLASSES = {
  theme: 'dd-on',
  statusBar: 'dd-bar',
  monoFont: 'dd-mono',
  squareAvatars: 'dd-square',
  hideMembers: 'dd-nomembers',
  hideNitro: 'dd-nonitro',
  hideActivity: 'dd-noactivity',
  hideGifs: 'dd-nogifs',
  stealth: 'dd-stealth',
  scanlines: 'dd-scan'
};
