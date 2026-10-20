# Seguridad

## Cómo reportar una vulnerabilidad

Abre un [aviso de seguridad privado](../../security/advisories/new) en lugar de un issue público.

## Modelo de amenazas

El formulario es **público**: cualquier persona puede enviar texto arbitrario. Ese texto
pasa por un modelo de IA, se guarda en una base de datos y se muestra en un panel interno.
Los riesgos principales son: abuso del endpoint, inyección (SQL, XSS, *prompt injection*),
fuga de datos personales (incluido el robo de la base de datos o de una copia de seguridad),
fuga de secretos y acceso no autorizado al panel.

## Gestión de secretos

| Secreto | Dónde vive | Quién lo ve |
|---|---|---|
| Clave AES-256 de datos de clientes | `secrets/triage_data_encryption_key` | Solo el contenedor `api` |
| Contraseña del rol `panel_api` | `secrets/api_db_password` | `db` (al crear el rol) y `api` |
| Contraseña de superusuario de Postgres | `secrets/postgres_password` | Solo `db` |
| Clave de cifrado de credenciales de n8n | `secrets/n8n_encryption_key` | Solo `n8n` |
| Token de Claude (Anthropic) | Credencial de n8n, **cifrada** con la clave anterior | Solo `n8n` |
| Clave del endpoint interno n8n → API | `secrets/triage_ingest_api_key` | `api` y la credencial cifrada de n8n |
| Clave del webhook | `secrets/webhook_api_key` | La credencial cifrada de n8n y nginx (en memoria, `/tmp`, permisos `0600`) para el formulario público. **Nunca el navegador** |
| Contraseña del panel | Solo su **hash scrypt** en `secrets/triage_admin_password_hash` | `api` |

- **No hay `.env`.** Cada secreto es un fichero montado como Docker secret en `/run/secrets/`, de solo lectura y solo en el contenedor que lo necesita.
- Los secretos **no están en variables de entorno**, así que no aparecen en `docker inspect`, en listados de procesos ni en volcados de errores. El CI lo comprueba.
- `secrets/` está en `.gitignore`, no se copia a ninguna imagen y queda fuera de la carpeta que sirve nginx.
- Se generan con `scripts/generate_secrets.py` usando `secrets` y `os.urandom`, que son generadores criptográficamente seguros.

## Controles aplicados

### OWASP Top 10 (2021)

| Riesgo | Control | Dónde |
|---|---|---|
| A01 Control de acceso | Panel con sesión obligatoria. Endpoint interno con clave propia y bloqueado en nginx. El rol de BD `panel_api` solo puede `SELECT`, `INSERT` y `UPDATE` del estado: no puede borrar ni modificar datos cifrados o la clasificación | `auth.py`, `ingest.py`, `nginx.conf`, `02_roles.sh`, `test_api_role_cannot_tamper_or_delete` |
| A01 Asignación masiva | `PATCH /tickets/{id}` solo acepta `estado`; la ingesta rechaza campos desconocidos y estados iniciales no permitidos | `schemas.py`, `test_update_only_allows_estado`, `test_ingest_validates_payload` |
| A02 Fallos criptográficos | **Datos de clientes cifrados en reposo con AES-256-GCM** (nonce aleatorio, AAD por columna, subclaves HKDF). Contraseña con scrypt + sal y comparación en tiempo constante. Cookie firmada `HttpOnly`, `SameSite=Strict`, `Secure` en HTTPS. Solo librerías probadas (`cryptography`), sin criptografía casera | `crypto.py`, `passwords.py`, `test_crypto.py`, `test_database_never_stores_personal_data_in_clear` |
| A03 Inyección SQL | Consultas siempre parametrizadas con `psycopg.sql`; filtros validados contra enums | `repository.py` |
| A03 XSS | Vue escapa por defecto y nunca se usa `v-html`; CSP estricta sin `unsafe-inline` | `TicketDetail.vue`, `nginx.conf`, `TicketTable.spec.ts` |
| A04 Diseño inseguro | Validación con lista blanca en n8n **y otra vez en la API**, que es la frontera de confianza; `CHECK` en BD como última barrera | nodo *Validar entrada*, `TicketIngest`, `01_schema.sql` |
| A05 Configuración | Cabeceras de seguridad, `/docs` desactivado en producción, contenedores sin root, FS de solo lectura, `cap_drop: ALL`, puertos solo en localhost | `security_headers.py`, `compose.yaml`, Dockerfiles |
| A06 Componentes vulnerables | pip-audit, npm audit, Trivy y Dependabot (pip, npm, Docker, compose, Actions) | `.github/` |
| A01/A05 Formulario público | La clave del webhook la añade nginx, no el navegador; se descartan la cookie de sesión y cualquier `Authorization` antes de enviar a n8n; solo `POST`; cuerpo máximo de 8 KB; *honeypot* contra bots; validación en cliente, n8n y API | `nginx.conf`, `docker/40-webhook-key.sh`, `contact.ts`, `ContactForm.spec.ts`, `contact.spec.ts` |
| A07 Autenticación | Bloqueo tras 5 intentos fallidos por IP + rate limit en nginx; mismo error para usuario o contraseña incorrectos; regeneración de sesión al entrar | `auth.py`, `nginx.conf`, `test_auth.py` |
| A09 Registro | Las ejecuciones correctas de n8n no se guardan; las fallidas se purgan a los 7 días | `compose.yaml` |

### OWASP Top 10 para aplicaciones LLM (2025)

| Riesgo | Control | Dónde |
|---|---|---|
| LLM01 Prompt injection | La consulta va delimitada y el *prompt* indica que es un dato, no una instrucción. Aun así, **la IA no decide el estado**: solo clasifica, y el código valida la salida | nodos *Clasificar consulta* y *Validar salida IA*, `samples/consultas.json` (caso de prueba) |
| LLM02 Revelación de información sensible | Minimización de datos: al modelo solo le llega el texto de la consulta, nunca el nombre ni el email | nodo *Clasificar consulta* |
| LLM05 Gestión inadecuada de la salida | La salida se valida contra listas cerradas en n8n y otra vez en la API; si algo no encaja o la confianza es < 0,7, el ticket va a `revision_manual` | nodo *Validar salida IA*, `TicketIngest` |
| LLM10 Consumo sin límites | Rate limit de 5 peticiones/min por IP en el webhook, cuerpo máximo de 8 KB, consulta de 4.000 caracteres como máximo, `maxTokens` limitado | `nginx.conf`, nodo *Validar entrada*, nodo *Claude* |

## Comprobaciones automáticas

| Herramienta | Tipo | Cuándo |
|---|---|---|
| Semgrep (Python, TypeScript, OWASP, secretos, Dockerfile) | SAST | cada push/PR |
| Ruff con reglas `S` (bandit) | SAST (lint) | cada push/PR |
| pip-audit y npm audit | Dependencias | cada push/PR + semanal |
| Trivy | Imágenes Docker | cada push/PR |
| gitleaks | Secretos en el historial | cada push/PR |
| `scripts/check_workflow.py` | Workflow de n8n sin credenciales ni secretos incrustados | cada push/PR |
| Smoke test de compose | Endpoint interno no expuesto, ningún secreto en variables de entorno | cada push/PR |
| OWASP ZAP baseline | DAST contra el stack levantado con Docker | cada push/PR |

## Limitaciones conocidas

- **El cifrado protege los datos en reposo**: un robo de la base de datos, de una copia de seguridad o un acceso SQL no revela datos personales. No protege si alguien compromete el propio contenedor de la API, porque es quien tiene la clave. En producción, la clave maestra debería estar en un gestor de secretos con auditoría de acceso (por ejemplo, Azure Key Vault).
- Los ficheros de `secrets/` están en el disco del servidor: su protección depende de los permisos del sistema (carpeta `0700`) y del acceso al host.
- **Búsqueda sobre datos cifrados:** el email solo se puede buscar de forma exacta. La búsqueda por texto libre descifra en memoria los 1.000 tickets más recientes que cumplen los filtros (`search_scan_limit`), así que no escala a volúmenes muy grandes.
- **La rotación de la clave de datos aún no está implementada**, aunque el formato ya incluye un byte de versión para hacerla.
- n8n procesa los datos del cliente en memoria mientras ejecuta el workflow. No guarda las ejecuciones correctas, y las fallidas se purgan a los 7 días.
- El bloqueo de intentos de login se guarda en memoria: vale para una instancia, pero con varias réplicas habría que moverlo a Redis.
