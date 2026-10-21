import { createApp } from 'vue'

// Self-hosted font: the CSP only allows same-origin resources.
import '@fontsource-variable/geist'

import './noxum.css'
import ContactForm from './ContactForm.vue'
import { initLanding } from './noxum'

initLanding()

// The real contact form (validation, consent, honeypot) is the only Vue island on the page.
const mount = document.getElementById('contact-form')
if (mount) createApp(ContactForm).mount(mount)
