// Classic script for <head>: marks .js before the first paint, so entrances start hidden instead of
// flashing. If cine.js has not started within 3 s (blocked, failed), it takes .js off so nothing stays hidden.
document.documentElement.classList.add('js');
setTimeout(function () {
  if (!document.documentElement.classList.contains('cine-ready')) document.documentElement.classList.remove('js');
}, 3000);
