import { createApp } from 'vue'

// Self-hosted font: the CSP only allows same-origin resources.
import '@fontsource-variable/geist'

// The cinematic layer (light streaks, scroll scenes, pointer effects) and the 3D scene engine
// (three.js, bundled from npm: no CDN). Both start every data-cine-* / data-s3d element on the page.
import './cine/cine.css'
import './cine/scenes.css'
import './s3d/scene3d.css'
import './noxum.css'
import './cinematic.css'
import './cine/cine.js'

import ContactForm from './ContactForm.vue'
import { initLanding } from './noxum'

initLanding()

// The real contact form (validation, consent, honeypot) is the only Vue island on the page.
const mount = document.getElementById('contact-form')
if (mount) createApp(ContactForm).mount(mount)

// three.js is large: it loads in its own file, and only when the page has a 3D scene.
if (document.querySelector('[data-s3d], [data-s3d-ring]')) void import('./s3d/index.js')
