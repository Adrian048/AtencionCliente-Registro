// Landing behaviour: live clocks, on-call tabs, the demo status panel, the method steps
// and scroll reveals. No third-party libraries; everything degrades to a static page.

import { SEVERITIES, madridTime, nowSentence, whoAnswers, type MadridTime, type Severity } from './clock'

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

// Highlights the time inside a plain sentence without using innerHTML.
function renderSentence(el: Element, sentence: string, hhmm: string): void {
  const i = sentence.indexOf(hhmm)
  if (i < 0) {
    el.textContent = sentence
    return
  }
  const strong = document.createElement('strong')
  strong.textContent = hhmm
  el.replaceChildren(sentence.slice(0, i), strong, sentence.slice(i + hhmm.length))
}

function initWatch(): () => void {
  const body = document.querySelector<HTMLElement>('.watch__body')
  const title = document.querySelector('[data-tab-title]')
  const text = document.querySelector('[data-tab-text]')
  const nowLine = document.querySelector('[data-watch-now]')
  const tabs = [...document.querySelectorAll<HTMLButtonElement>('[data-tab]')]
  let current: Severity = 'caida'

  const renderNow = (t: MadridTime = madridTime()) => {
    if (nowLine) renderSentence(nowLine, nowSentence(current, t), t.hhmm)
  }

  const select = (btn: HTMLButtonElement, focus = false) => {
    const key = btn.dataset.tab as Severity
    if (key === current || !body || !title || !text) return
    current = key
    tabs.forEach((b) => {
      const on = b === btn
      b.setAttribute('aria-selected', String(on))
      b.tabIndex = on ? 0 : -1
    })
    body.setAttribute('aria-labelledby', btn.id)
    if (focus) btn.focus()
    const swap = () => {
      title.textContent = SEVERITIES[key].title
      text.textContent = SEVERITIES[key].text
      renderNow()
    }
    if (reduce) return swap()
    body.classList.add('is-swap')
    window.setTimeout(() => {
      swap()
      body.classList.remove('is-swap')
    }, 200)
  }

  tabs.forEach((b, i) => {
    b.addEventListener('click', () => select(b))
    b.addEventListener('keydown', (e) => {
      const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
      if (!dir) return
      e.preventDefault()
      select(tabs[(i + dir + tabs.length) % tabs.length], true)
    })
  })
  return renderNow
}

function initClocks(renderNow: (t: MadridTime) => void): void {
  const clocks = document.querySelectorAll('[data-clock], [data-clock-big]')
  const shift = document.querySelector('[data-shift]')
  const cells = [...document.querySelectorAll<HTMLElement>('[data-now]')]
  const tick = () => {
    const t = madridTime()
    clocks.forEach((c) => (c.textContent = t.hhmm))
    if (shift) {
      shift.textContent = whoAnswers('caida', t) === 'Equipo'
        ? 'Horario de oficina · equipo completo y guardia'
        : 'Fuera de horario · 2 ingenieros de guardia'
    }
    cells.forEach((c) => (c.textContent = whoAnswers(c.dataset.now as Severity, t)))
    renderNow(t)
  }
  tick()
  window.setInterval(tick, 20_000)
}

// Demo status panel: example latencies that breathe. Paused off screen and with reduced motion.
function initStatusPanel(): void {
  const rows = [...document.querySelectorAll('.status__row')].flatMap((row) => {
    const val = row.querySelector<HTMLElement>('[data-ms]')
    const line = row.querySelector('[data-spark] polyline')
    if (!val || !line) return []
    const base = Number(val.dataset.ms)
    return [{ val, line, base, series: Array.from({ length: 24 }, () => base * (0.85 + Math.random() * 0.3)) }]
  })
  const draw = (r: (typeof rows)[number]) => {
    const max = Math.max(...r.series) * 1.1
    const min = Math.min(...r.series) * 0.9
    const points = r.series.map((v, i) => `${(i / (r.series.length - 1)) * 100},${24 - ((v - min) / (max - min)) * 22 - 1}`)
    r.line.setAttribute('points', points.join(' '))
  }
  rows.forEach(draw)
  if (reduce) return

  let visible = true
  const panel = document.querySelector('.ui--status')
  if (panel) new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(panel)
  window.setInterval(() => {
    if (!visible || document.hidden) return
    rows.forEach((r) => {
      const next = r.base * (0.85 + Math.random() * 0.3)
      r.series.push(next)
      r.series.shift()
      r.val.textContent = `${Math.round(next)} ms`
      draw(r)
    })
  }, 1800)
}

function initBar(): void {
  const bar = document.querySelector('.bar')
  const onScroll = () => bar?.classList.toggle('is-scrolled', window.scrollY > 8)
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
}

// Method: the step crossing the middle of the screen lights up its document.
function initSteps(): void {
  const root = document.querySelector('[data-steps]')
  if (!root) return
  const items = [...root.querySelectorAll('.steps__item')]
  const pics = [...root.querySelectorAll('[data-pic]')]
  const count = root.querySelector('.steps__count')
  const show = (i: number) => {
    items.forEach((el, k) => el.classList.toggle('is-active', k === i))
    pics.forEach((el, k) => el.classList.toggle('is-on', k === i))
    if (count) count.textContent = `Fase ${i + 1} de ${items.length}`
  }
  const band = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && show(items.indexOf(e.target))),
    { rootMargin: '-45% 0px -45% 0px' },
  )
  items.forEach((el) => band.observe(el))
  show(0)
}

// Entrances, once, as each element enters the screen.
function initReveals(): void {
  if (!reduce) document.querySelectorAll('.lines:not(.hero__title)').forEach((el) => el.classList.add('is-armed'))
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        e.target.classList.add('is-in')
        io.unobserve(e.target)
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.08 },
  )
  document.querySelectorAll('[data-reveal], .lines').forEach((el) => io.observe(el))
  document.querySelectorAll('section').forEach((sec) => {
    sec.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el, i) => {
      el.style.transitionDelay = `${Math.min(i, 4) * 70}ms`
    })
  })
}

export function initLanding(): void {
  // Hidden "before" states only apply once the script runs, so without JS everything is visible.
  document.documentElement.classList.add('js')
  initClocks(initWatch())
  initStatusPanel()
  initBar()
  initSteps()
  initReveals()
}
