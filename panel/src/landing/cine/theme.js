// The page changes colour as you scroll: each [data-cine-theme] section, when it reaches the middle of
// the screen, gives the page its ground, ink and accent (three CSS colours). The values go to
// --theme-ground / --theme-ink / --theme-accent on <html>, registered in cine.css so they ease.
//
//   <section data-cine-theme="#f3ede4, #1d1a16, #a07a4f">…</section>     light, warm
//   <section data-cine-theme="#0f0e0c, #f3ede4, #d8b98a">…</section>     dark
//
// The page uses them: body { background: var(--theme-ground); color: var(--theme-ink); }.
// A colour may be left empty to keep the current one ("#000, , #f00").

export function initTheme(root) {
  const sections = [...root.querySelectorAll('[data-cine-theme]')];
  if (!sections.length) return () => {};
  const html = document.documentElement;
  const names = ['--theme-ground', '--theme-ink', '--theme-accent'];
  const apply = (el) => {
    el.dataset.cineTheme.split(',').map((s) => s.trim()).forEach((v, i) => { if (v && names[i]) html.style.setProperty(names[i], v); });
    html.dataset.cineThemeAt = el.id || '';
  };
  apply(sections[0]);
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) apply(e.target);
  }, { rootMargin: '-50% 0px -50% 0px' });
  sections.forEach((s) => io.observe(s));
  return () => io.disconnect();
}
