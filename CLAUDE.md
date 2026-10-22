# CLAUDE.md: n8n-ai-support-triage

**Lee primero [`ContextoClaude/contexto-proyecto.md`](ContextoClaude/contexto-proyecto.md)**
(resumen de 30 segundos, estado, problemas ya resueltos y pendientes). Si no existe, todo lo
técnico está en `README.md` y `SECURITY.md`.

En pocas palabras:
1. La landing pública de **Noxum** (consultora ficticia, `/`) envía la consulta.
2. **n8n + Claude** la clasifican.
3. La API **FastAPI** la cifra (AES-256-GCM) y la guarda en **PostgreSQL**.
4. Se gestiona desde un **panel Vue 3** (`/panel/`).

Todo corre con `docker compose up -d` (antes hay que abrir Docker Desktop).

Reglas del proyecto:
- Habla **en español** con Adrián.
- **Git lo maneja Adrián:** él hace commits, push y merge. Prepara los cambios, verifícalos y
  dale todos los comandos de golpe. Antes, mira con `git status` y `git log origin/main` qué ha
  subido ya.
- **Secretos:** solo como Docker secrets en `secrets/`. **Nunca `.env`** ni secretos en
  variables de entorno. **Nunca** ejecutes `scripts/generate_secrets.py --force`: regenera la
  clave de datos y los tickets dejarían de poder leerse.
- **Datos de clientes:** se cifran en la API (`api/src/triage_api/crypto.py`). La base de
  datos solo ve bytes. n8n no accede a la base de datos.
- **La IA no decide:** su salida se valida contra listas cerradas, en n8n y en la API.
- **No reimportes el workflow de n8n sin avisar**: desasigna las credenciales y lo despublica.
- **La landing respeta la CSP de nginx:** nada de fuentes, scripts o CDN de terceros, ni
  `<script>` o atributos `style` en línea, ni `'unsafe-inline'`. La única pieza Vue de la
  landing es el formulario (`src/landing/ContactForm.vue`).
- **README corto:** el README principal no lleva capturas; las capturas viven en
  `docs/funcionamiento/` (con su propio `README.md`).
- **Shell en Windows:**
  - añade Docker (`/c/Program Files/Docker/Docker/resources/bin`) y Node
    (`/c/Program Files/nodejs`) al PATH;
  - usa `MSYS_NO_PATHCONV=1` con `docker compose exec`;
  - usa `127.0.0.1` en lugar de `localhost`;
  - al editar ficheros con Python, escribe con `newline=''` para no meter CRLF.
- **Tests:** `cd api && .venv/Scripts/pytest -q` · `cd panel && npm test && npm run build`.
- **Al terminar algo importante, actualiza `ContextoClaude/contexto-proyecto.md`.**
