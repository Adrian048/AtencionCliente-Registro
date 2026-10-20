<script setup lang="ts">
import ContactForm from './ContactForm.vue'

const year = new Date().getFullYear()

const services = [
  {
    id: 'ciberseguridad',
    title: 'Ciberseguridad IT/OT',
    text: 'Auditorías y pentesting, adecuación a ENS, ISO 27001 y NIS2, y protección de redes industriales donde un fallo para la producción.',
    points: ['Pentesting web e infraestructura', 'Segmentación de redes OT', 'Respuesta a incidentes'],
    icon: 'M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z M9 12l2 2 4-4',
  },
  {
    id: 'desarrollo',
    title: 'Software a medida',
    text: 'Paneles de gestión, portales y APIs construidos para tu forma de trabajar, con seguridad desde la primera línea de código.',
    points: ['Paneles con roles y permisos', 'Integraciones con tus sistemas', 'Web y móvil'],
    icon: 'M8 7l-5 5 5 5 M16 7l5 5-5 5 M14 4l-4 16',
  },
  {
    id: 'ia',
    title: 'Inteligencia artificial aplicada',
    text: 'Automatizamos tareas repetitivas con IA: lectura de documentos, clasificación de consultas o asistentes internos. Con modelos privados cuando los datos son confidenciales.',
    points: ['Automatización de documentos', 'Asistentes y chatbots', 'Modelos autoalojados'],
    icon: 'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M5.6 18.4l2.1-2.1 M16.3 7.7l2.1-2.1 M12 9a3 3 0 100 6 3 3 0 000-6z',
  },
  {
    id: 'mantenimiento',
    title: 'Mantenimiento y soporte',
    text: 'Mantenemos vivo lo que ya funciona: actualizaciones, evolutivos y corrección de vulnerabilidades, también en aplicaciones heredadas.',
    points: ['Actualización de versiones', 'Evolutivos y mejoras', 'Soporte ante incidencias'],
    icon: 'M14.7 6.3a4 4 0 00-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 005.4-5.4l-2.5 2.5-2.4-.6-.6-2.4 2.5-2.5z',
  },
]

const steps = [
  { title: 'Escuchamos', text: 'Nos cuentas tu caso. Tu consulta llega clasificada al especialista adecuado.' },
  { title: 'Proponemos', text: 'Analizamos qué hace falta y te enviamos una propuesta clara, con alcance y plazos.' },
  { title: 'Construimos', text: 'Entregas frecuentes para que veas avances reales desde las primeras semanas.' },
  { title: 'Acompañamos', text: 'Mantenimiento, soporte y mejoras cuando el proyecto ya está en marcha.' },
]

const guarantees = [
  {
    title: 'Tus datos, cifrados',
    text: 'Nombre, email y consulta se guardan cifrados con AES-256. Ni con acceso a la base de datos se pueden leer.',
  },
  {
    title: 'La IA ve lo mínimo',
    text: 'Clasificamos tu consulta con IA para que llegue antes a quien corresponde, pero el modelo solo lee el texto: nunca tu nombre ni tu email.',
  },
  {
    title: 'Personas al mando',
    text: 'La IA ordena, no decide. Si una consulta es dudosa, la revisa una persona del equipo.',
  },
]

const faqs = [
  {
    q: '¿Trabajáis con empresas pequeñas?',
    a: 'Sí. Adaptamos el alcance a cada caso: desde una auditoría puntual hasta acompañar un proyecto completo.',
  },
  {
    q: '¿Qué pasa si tengo un incidente de seguridad ahora mismo?',
    a: 'Indícalo en el formulario. Las consultas urgentes se detectan automáticamente y se priorizan por delante del resto.',
  },
  {
    q: '¿Podéis usar IA sin enviar mis datos a terceros?',
    a: 'Sí. Para información confidencial trabajamos con modelos autoalojados que se ejecutan en tu infraestructura.',
  },
  {
    q: '¿Mantenéis aplicaciones que no habéis desarrollado vosotros?',
    a: 'Sí, incluidas aplicaciones heredadas. Empezamos con una revisión del código y de su seguridad.',
  },
]
</script>

<template>
  <a class="skip-link" href="#contacto">Ir al formulario de contacto</a>

  <header class="site-header">
    <div class="container header-inner">
      <a href="#" class="brand" aria-label="Nodal, inicio">
        <span class="brand-mark" aria-hidden="true"></span>
        Nodal
      </a>
      <nav aria-label="Principal">
        <a href="#servicios">Servicios</a>
        <a href="#proceso">Cómo trabajamos</a>
        <a href="#seguridad">Seguridad</a>
        <a href="#faq">Preguntas</a>
      </nav>
      <a href="#contacto" class="btn btn-primary btn-sm">Contactar</a>
    </div>
  </header>

  <main>
    <section class="hero">
      <div class="container hero-inner">
        <p class="eyebrow">Ciberseguridad · Software a medida · IA</p>
        <h1>Tecnología segura para empresas que <span class="accent">no pueden parar</span>.</h1>
        <p class="lead">
          Protegemos tus sistemas IT y OT, desarrollamos las herramientas que tu equipo necesita y
          aplicamos inteligencia artificial a procesos reales, con tus datos siempre bajo control.
        </p>
        <div class="hero-cta">
          <a href="#contacto" class="btn btn-primary">Cuéntanos tu caso</a>
          <a href="#servicios" class="btn btn-secondary">Ver servicios</a>
        </div>
        <ul class="trust" aria-label="Lo que nos define">
          <li><strong>IT + OT</strong><span>de la oficina a la planta</span></li>
          <li><strong>Seguridad</strong><span>desde el diseño</span></li>
          <li><strong>IA privada</strong><span>para datos confidenciales</span></li>
          <li><strong>Un solo equipo</strong><span>de principio a fin</span></li>
        </ul>
      </div>
    </section>

    <section id="servicios" class="section">
      <div class="container">
        <header class="section-head">
          <p class="eyebrow">Servicios</p>
          <h2>Todo lo que tu tecnología necesita, en un mismo equipo</h2>
        </header>
        <div class="services">
          <article v-for="s in services" :key="s.id" class="service">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="s.icon" /></svg>
            <h3>{{ s.title }}</h3>
            <p>{{ s.text }}</p>
            <ul>
              <li v-for="p in s.points" :key="p">{{ p }}</li>
            </ul>
          </article>
        </div>
      </div>
    </section>

    <section id="proceso" class="section section-alt">
      <div class="container">
        <header class="section-head">
          <p class="eyebrow">Cómo trabajamos</p>
          <h2>De la primera consulta al proyecto en marcha</h2>
        </header>
        <ol class="steps">
          <li v-for="(step, i) in steps" :key="step.title">
            <span class="step-number" aria-hidden="true">{{ i + 1 }}</span>
            <h3>{{ step.title }}</h3>
            <p>{{ step.text }}</p>
          </li>
        </ol>
      </div>
    </section>

    <section id="seguridad" class="section">
      <div class="container security">
        <div>
          <p class="eyebrow">Seguridad desde el diseño</p>
          <h2>Aplicamos contigo lo mismo que aplicamos a nuestros clientes</h2>
          <p class="lead">
            Este formulario es un ejemplo: cada consulta se valida, se clasifica con IA y se guarda
            cifrada antes de que nadie la lea.
          </p>
        </div>
        <ul class="guarantees">
          <li v-for="g in guarantees" :key="g.title">
            <svg class="icon icon-sm" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12l5 5L20 7" />
            </svg>
            <div>
              <h3>{{ g.title }}</h3>
              <p>{{ g.text }}</p>
            </div>
          </li>
        </ul>
      </div>
    </section>

    <section id="faq" class="section section-alt">
      <div class="container narrow">
        <header class="section-head">
          <p class="eyebrow">Preguntas frecuentes</p>
          <h2>Lo que suelen preguntarnos</h2>
        </header>
        <div class="faq">
          <details v-for="f in faqs" :key="f.q">
            <summary>{{ f.q }}</summary>
            <p>{{ f.a }}</p>
          </details>
        </div>
      </div>
    </section>

    <section id="contacto" class="section contact">
      <div class="container contact-inner">
        <div class="contact-intro">
          <p class="eyebrow">Contacto</p>
          <h2>Cuéntanos tu caso</h2>
          <p class="lead">
            Respondemos a todas las consultas. Si se trata de algo urgente, como un servicio caído o
            un posible incidente de seguridad, dilo en el mensaje y lo priorizaremos.
          </p>
          <ul class="contact-points">
            <li>Presupuestos sin compromiso</li>
            <li>Atención por especialistas, no por bots</li>
            <li>Tus datos, cifrados de principio a fin</li>
          </ul>
        </div>
        <ContactForm />
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container footer-inner">
      <p>© {{ year }} Nodal.</p>
      <p class="disclaimer">
        Nodal es una <strong>empresa ficticia</strong> creada como demo para el proyecto de portfolio
        <a href="https://github.com/Adrian048/AtencionCliente-Registro" rel="noopener noreferrer">AtencionCliente-Registro</a>.
      </p>
    </div>
  </footer>
</template>
