// Runs before first paint so the page never flashes the wrong theme or language.
(function () {
  var th = null, lg = null;
  try { th = localStorage.getItem('theme'); lg = localStorage.getItem('lang'); } catch (e) {}
  var root = document.documentElement;
  root.dataset.theme = th === 'light' ? 'light' : 'dark';
  root.lang = lg === 'uk' || lg === 'en' ? lg : ((navigator.language || '').toLowerCase().indexOf('uk') === 0 ? 'uk' : 'en');
})();
