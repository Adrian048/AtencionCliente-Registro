# Funcionamiento

Recorrido completo de una consulta, de la landing al panel, en 21 capturas numeradas en orden.
Vuelve al [README del proyecto](../../README.md).

## 1. La landing de Noxum

La consultora ficticia **Noxum** presenta sus servicios. Los paneles de la web (estado de la
guardia, despliegue, auditoría, asistente de IA) son fragmentos de interfaz con datos de
ejemplo; el reloj de guardia usa la hora real de Madrid.

| | |
|---|---|
| ![Portada](01-landing-portada.png) | ![Tecnologías y servicios](02-landing-tecnologias-y-servicios.png) |
| ![Servicios de IA y guardia](03-landing-servicios-ia-y-guardia.png) | ![Banda nocturna](04-landing-banda-nocturna.png) |
| ![Guardia 24/7](05-landing-guardia-24-7.png) | ![Pestaña «Va lento»](06-landing-guardia-pestana-va-lento.png) |
| ![Método, fase 1](07-landing-metodo-fase-1.png) | ![Método, fase 2](08-landing-metodo-fase-2.png) |
| ![Método, fase 3](09-landing-metodo-fase-3.png) | ![Normas y formas de colaborar](10-landing-normas-y-formas-de-colaborar.png) |
| ![Preguntas frecuentes](11-landing-preguntas-frecuentes.png) | ![Contacto](12-landing-contacto.png) |

## 2. El cliente envía su consulta

El formulario valida los datos en el navegador y los envía a `/api/public/contacto`. nginx
añade la clave del webhook (el navegador nunca la ve) y los pasa a n8n.

| | |
|---|---|
| ![Formulario relleno](13-landing-formulario-relleno.png) | ![Consulta recibida con su referencia](14-landing-consulta-recibida.png) |

## 3. También en el móvil

| | | | |
|---|---|---|---|
| ![Portada en el móvil](15-movil-portada.png) | ![Panel de guardia en el móvil](16-movil-panel-de-guardia.png) | ![Reloj de guardia en el móvil](17-movil-reloj-de-guardia.png) | ![Formulario en el móvil](18-movil-formulario.png) |

## 4. El equipo la gestiona en el panel

n8n valida la consulta, **Claude** la clasifica (categoría, prioridad, sentimiento y
resumen), el código comprueba la respuesta de la IA y la API la **cifra** antes de guardarla.
En el panel, con login, se ve ya clasificada y descifrada. La consulta de las capturas 13 y
14 aparece como **#14: incidencia urgente por phishing**.

| | |
|---|---|
| ![Login del panel](19-panel-login.png) | ![Tickets clasificados](20-panel-tickets-clasificados.png) |
| ![Búsqueda de un ticket](21-panel-busqueda-ticket.png) | |
