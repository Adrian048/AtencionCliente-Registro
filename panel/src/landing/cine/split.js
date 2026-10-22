// Text split into words (or characters) for two moves:
//
//   <h1 data-cine-text="rise">…</h1>    each word rises out of its own mask, in reading order, when the
//                                       heading enters the screen (or straight away when it is in the
//                                       first screen). data-cine-text="chars" does the same per letter.
//   <p data-cine-text="scrub">…</p>     words light up one by one as the paragraph crosses the screen
//                                       (driven by --pv, so it also adds data-cine-progress).
//
// Inline elements inside (em, strong, a, span, br) are kept. Screen readers get the sentence once: the
// split copy is aria-hidden and the original text is kept in a visually hidden span. Only text nodes are
// created (textContent), never HTML.

const WS = /(\s+)/;

function splitInto(node, mode, counter) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      if (child.tagName !== 'BR') splitInto(child, mode, counter);
      continue;
    }
    if (child.nodeType !== Node.TEXT_NODE || !child.textContent.trim()) continue;
    const frag = document.createDocumentFragment();
    for (const part of child.textContent.split(WS)) {
      if (!part) continue;
      if (WS.test(part)) { frag.append(document.createTextNode(part)); continue; }
      const mask = document.createElement('span');
      mask.className = 'cine-wm';
      if (mode === 'chars') {
        for (const ch of part) {
          const c = document.createElement('span');
          c.className = 'cine-w';
          c.textContent = ch;
          c.style.setProperty('--i', counter.i++);
          mask.append(c);
        }
      } else {
        const w = document.createElement('span');
        w.className = 'cine-w';
        w.textContent = part;
        w.style.setProperty('--i', counter.i++);
        mask.append(w);
      }
      frag.append(mask);
    }
    child.replaceWith(frag);
  }
}

export function initSplit(root, env) {
  const els = [...root.querySelectorAll('[data-cine-text]')];
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -12% 0px' });

  for (const el of els) {
    if (el.dataset.cineSplit === 'done') continue;
    const mode = el.dataset.cineText;
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    const visual = document.createElement('span');
    visual.className = 'cine-split';
    visual.setAttribute('aria-hidden', 'true');
    while (el.firstChild) visual.append(el.firstChild);
    const counter = { i: 0 };
    splitInto(visual, mode === 'chars' ? 'chars' : 'words', counter);
    const sr = document.createElement('span');
    sr.className = 'cine-sr';
    sr.textContent = text;
    el.append(sr, visual);
    el.style.setProperty('--n', counter.i);
    el.dataset.cineSplit = 'done';

    if (mode === 'scrub') {
      if (!el.hasAttribute('data-cine-progress')) el.setAttribute('data-cine-progress', '');
    } else if (env.reduced) {
      el.classList.add('is-in');
    } else {
      io.observe(el);
    }
  }
  return () => io.disconnect();
}
