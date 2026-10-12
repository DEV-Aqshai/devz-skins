// shared by content scripts + popup
window.YD_DEFAULTS = {
  theme: true,          // terminal skin
  statusBar: true,      // tmux-style bottom bar
  monoFont: true,       // monospace everywhere (captions untouched)
  terminalLogo: true,   // replaces the YouTube logo with devz@yt:~$
  dimThumbs: true,      // thumbnails desaturated until hover
  hideShorts: true,
  hideFeed: false,      // blank home feed (focus mode)
  hideComments: false,
  hideRelated: false,   // watch-page sidebar
  hideAmbient: true,    // ambient / cinematics glow
  rememberSpeed: true,  // keep your playback speed across videos
  scanlines: false,
  accent: '#4dffa0',
  speed: 1
};

window.YD_ACCENTS = {
  green: '#4dffa0',
  amber: '#ffb454',
  cyan: '#5ccfff',
  magenta: '#ff6ac1',
  red: '#ff5c6c'
};

// setting -> class on <html>
window.YD_FLAG_CLASSES = {
  theme: 'yd-on',
  statusBar: 'yd-bar',
  monoFont: 'yd-mono',
  terminalLogo: 'yd-logo',
  dimThumbs: 'yd-dim',
  hideShorts: 'yd-noshorts',
  hideFeed: 'yd-nofeed',
  hideComments: 'yd-nocomments',
  hideRelated: 'yd-norelated',
  hideAmbient: 'yd-noambient',
  scanlines: 'yd-scan'
};
