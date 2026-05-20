# 5-WPL-software-review-guidelines.pdf

## Enlace al despliegue
- Backend: https://vecinus-backend.onrender.com 
- Frontend: https://vecinus.onrender.com

## Enlace a la página de Release en GitHub

Esta página de release fue creada mediante un comando que especifica las fechas de inicio y fin del WPL.

- https://github.com/Vecinus/vecinus/releases/tag/WPL

## Casos de uso implementados

### Chat de comunidad

Canal de mensajería en tiempo real donde los vecinos de una misma comunidad pueden comunicarse de forma instantánea. Al unirse a la comunidad, todos los miembros se incorporan automáticamente al chat grupal. Los usuarios pueden enviar, editar y eliminar sus propios mensajes, así como iniciar conversaciones privadas con cualquier otro vecino del mismo canal. Se reciben notificaciones cuando llegan nuevos mensajes.

**Roles con acceso:**
- **Crear el canal grupal:** Administrador, Presidente.
- **Enviar, editar, eliminar mensajes y conversar en privado:** Todos los miembros (Administrador, Propietario, Inquilino, Presidente, Empleado).

---

### Asistente IA (Chatbot de comunidad)

Asistente virtual inteligente que responde preguntas sobre la comunidad basándose en los documentos que se hayan subido previamente (normativas, estatutos, actas, reglamentos, etc.). Los vecinos pueden consultar dudas en lenguaje natural y recibir respuestas contextualizadas. La subida y gestión de los documentos que alimentan al asistente está restringida a los roles de gestión.

**Roles con acceso:**
- **Subir y eliminar documentos de conocimiento:** Administrador, Presidente.
- **Consultar al asistente (hacer preguntas):** Todos los miembros (Administrador, Propietario, Inquilino, Presidente, Empleado).

---

### Reserva de zonas comunes

Permite gestionar las instalaciones compartidas de la comunidad (piscina, salón de actos, pistas deportivas, etc.). Los vecinos pueden consultar la disponibilidad de cada instalación, realizar reservas en las franjas horarias disponibles y crear pases de invitados para autorizar la entrada de personas externas. Incluye un sistema de validación de acceso mediante códigos QR y la posibilidad de gestionar y cancelar las reservas propias. Si una zona común se intenta borrar y se esta tiene reservas hechas saltará un aviso que permite eliminar en cascada tanto la zona común como las reservas.

**Roles con acceso:**
- **Crear, editar y eliminar instalaciones:** Administrador, Presidente.
- **Consultar disponibilidad, realizar reservas, crear pases de invitados y cancelar reservas propias:** Todos los miembros (Administrador, Propietario, Inquilino, Presidente, Empleado).

---

### Incidencias

Módulo para reportar y hacer seguimiento de averías o problemas dentro de la comunidad (iluminación, ascensor, fontanería, seguridad, etc.). Los vecinos pueden crear incidencias con descripción, categoría y fotografía opcional. Cada incidencia sigue un flujo de estados: Pendiente → En progreso → Resuelta o Descartada. Las incidencias descartadas solo son visibles para los roles de gestión.

**Roles con acceso:**
- **Crear incidencias:** Todos los miembros (Administrador, Propietario, Inquilino, Presidente, Empleado).
- **Cambiar el estado de las incidencias:** Administrador, Presidente, Empleado.
- **Ver todas las incidencias, incluidas las descartadas:** Administrador, Presidente.
- **Ver incidencias (excepto descartadas):** Propietario, Inquilino, Empleado.
- **Eliminar incidencias resueltas o descartadas:** Administrador, Presidente o el creador de la incidencia.

---

### Transcripción de actas

Permite subir grabaciones de audio de las reuniones de la comunidad y generar automáticamente un acta estructurada con los puntos tratados, acuerdos adoptados y asistentes. El acta generada puede descargarse como documento Word. Todos los miembros de la comunidad pueden consultar las actas ya creadas.

**Roles con acceso:**
- **Subir audio y generar actas:** Administrador, Presidente.
- **Descargar el documento del acta:** Todos los miembros (Administrador, Propietario, Inquilino, Presidente, Empleado).
- **Consultar las actas existentes:** Todos los miembros (Administrador, Propietario, Inquilino, Presidente, Empleado).

---

### Gestión de multicomunidad

Cada usuario puede pertenecer a varias comunidades de vecinos a la vez y cambiar entre ellas desde el menú lateral. Incluye la creación de nuevas comunidades, la invitación de miembros por correo electrónico (con enlace de aceptación que caduca en 24 horas), la gestión de propiedades y la asignación de roles. Los usuarios invitados pueden aceptar o rechazar invitaciones directamente desde la aplicación.

**Roles con acceso:**
- **Crear comunidades:** Cualquier usuario registrado (se convierte en Administrador de la nueva comunidad tras realizar el pago).
- **Invitar miembros, gestionar propiedades y eliminar miembros:** Administrador, Presidente.
- **Invitar inquilinos a su propia propiedad:** Propietario.
- **Aceptar o rechazar invitaciones:** Cualquier usuario con invitación pendiente.
- **Cambiar de comunidad activa:** Todos los miembros.

---

### Registro de administradores junto con el pago

Flujo de alta para nuevos administradores que integra el registro de usuario con el pago de la cuota de suscripción mediante domiciliación bancaria. Al completar el pago, se crea automáticamente la cuenta del administrador, la comunidad y su membresía.

**Roles con acceso:**
- **Realizar el registro con pago:** Usuarios no registrados que desean crear una comunidad (se convierten en Administrador tras completar el proceso).

---

### Votaciones

Sistema de votaciones vinculantes para la comunidad conforme a la Ley de Propiedad Horizontal, aplicando la doble mayoría (por número de personas y por cuotas de participación). El Administrador o Presidente crea las votaciones, las configura con las opciones de voto y las publica, momento en el que cada propietario con derecho a voto recibe un enlace personal e intransferible por correo electrónico. Antes de votar, el vecino se autentica con un código de verificación enviado a su email. El escrutinio se calcula automáticamente. Los vecinos morosos quedan excluidos de la votación.

**Roles con acceso:**
- **Crear, editar, publicar, cerrar y eliminar votaciones:** Administrador, Presidente. (Editar y eliminar votaciones sólo cuando están en estado borrador)
- **Ver el listado de votaciones y los resultados:** Todos los miembros (Administrador, Propietario, Inquilino, Presidente, Empleado).
- **Ver la lista detallada de votantes en los resultados:** Administrador, Presidente.
- **Votar:** Propietarios y Presidentes con propiedad asignada y sin deudas pendientes.

---

### Tablón de anuncios

Módulo para publicar comunicados y anuncios oficiales de la comunidad, con posibilidad de adjuntar imágenes. Los anuncios pueden guardarse como borradores o publicarse directamente, e incluyen una opción de publicación programada para que se publiquen automáticamente en la fecha y hora elegidas (solo para los anuncios en borrador). Un anuncio publicado no puede volver a estado de borrador.

**Roles con acceso:**
- **Crear, editar y eliminar anuncios:** Administrador, Presidente.
- **Ver borradores de anuncios:** Administrador, Presidente.
- **Ver anuncios publicados:** Todos los miembros (Administrador, Propietario, Inquilino, Presidente, Empleado).

## Fallos y mejoras identificados por los PUGs

Los siguientes puntos resumen los problemas detectados durante la revisión, las acciones correctivas aplicadas y el resultado final obtenido tras la validación por parte de los equipos de QA, backend y frontend. Para esta última entrega, muchos de los participantes del equipo han invertido su tiempo en realizar una corrección de errores y bugs que se han ido acumulando a lo largo del ciclo de vida del proyecto. Como son muchos los fallos y mejoras, se presenta un resumen de los mismos:

**Error al eliminar una zona común**
El error comentado por los PUGs describía la imposibilidad de eliminar una zona común. Tras revisarlo, este error ocurría unicamente en los casos en los que esta zona común presentaba reservas realizadas por otros usuarios. Como solución propuesta, ahora si pulsamos en eliminar y encontramos este error nos saltaría una alerta indicándonos que hay reservas realizadas, y si continuamos, eliminaríamos tanto las reservas como la zona común.

**Error al intentar programar un anuncio**
El error descrito por los PUGs comenta que no funcionan los anuncios programadas, básicamente se publican en la hora actual en lugar de la programada. Como tal esto no es un error, sino una malinterpretación de los casos de uso. Se ha corregido el documento de entrega para que no vuelva a ocurrir, pero básicamente, para que se pueda publicar un anuncio programado debe guardarse en modo borrador.

**Error con las invitaciones a las votaciones**
El error aparece cuando se intenta abrir el enlace a una votación que llega al correo, saltando una pantalla de error e impidiendo la votación. Se corrige este error para que al abrir el enlace de las votaciones se redirija a una pestaña dentro de la app y permita realizar la votación.

**Errores no controlados y mensajes de error inconsistente en formularios**
Al crear zonas comunes no se controlaban campos como el máximo de caractéres da todas y cada de las propiedades de la zona común. Además, existía una incosistencia en los mensajes de error, pues algunos aparecían como un modal y otros como una simple alerta de error. Se han añadido validadores a todos lo campos y se han corregido los mensajes para que tengan todas la misma apariencia.
 
## Datos necesarios para realizar la revisión

| Email | Contraseña | Rol | 
| ----- | ---------- | --- |
| carlosanchez@vecinus.com | 1234567890 | Administrador |
| joaquinavalencia@vecinus.com | 1234567890 | Empleado |
| rodolfosuarez@vecinus.com | 1234567890 | Propietario |
| taniantunnez@vecinus.com | 1234567890 | Presidente |
| gonzalojesus@vecinus.com | 1234567890 | Inquilino |

## Requisitos potenciales
- Es necesario acceder primero al backend y luego, se podrá acceder al frontend una vez que el backend esté iniciado.
- El IBAN de prueba a utilizar para los pagos es: DE89370400440532013000 ; y el país Alemania. El resto de campos se pueden rellenar como se desee.
- Si registras una nueva cuenta, tendrás que verificar en el correo para poder iniciar sesión.