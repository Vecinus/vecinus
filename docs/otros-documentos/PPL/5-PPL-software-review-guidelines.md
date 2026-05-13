# 5-PPL-software-review-guidelines.pdf

## Enlace al despliegue
- Backend: https://vecinus-backend-ppl.onrender.com 
- Frontend: https://vecinus-ppl.onrender.com

## Enlace a la página de Release en GitHub

Esta página de release fue creada mediante un comando que especifica las fechas de inicio y fin del PPL.

- https://github.com/Vecinus/vecinus/releases/tag/PPL

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

Permite gestionar las instalaciones compartidas de la comunidad (piscina, salón de actos, pistas deportivas, etc.). Los vecinos pueden consultar la disponibilidad de cada instalación, realizar reservas en las franjas horarias disponibles y crear pases de invitados para autorizar la entrada de personas externas. Incluye un sistema de validación de acceso mediante códigos QR y la posibilidad de gestionar y cancelar las reservas propias.

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

Módulo para publicar comunicados y anuncios oficiales de la comunidad, con posibilidad de adjuntar imágenes. Los anuncios pueden guardarse como borradores o publicarse directamente, e incluyen una opción de publicación programada para que se publiquen automáticamente en la fecha y hora elegidas. Un anuncio publicado no puede volver a estado de borrador.

**Roles con acceso:**
- **Crear, editar y eliminar anuncios:** Administrador, Presidente.
- **Ver borradores de anuncios:** Administrador, Presidente.
- **Ver anuncios publicados:** Todos los miembros (Administrador, Propietario, Inquilino, Presidente, Empleado).

## Fallos y mejoras identificados por los PUGs

Los siguientes puntos resumen los problemas detectados durante la revisión, las acciones correctivas aplicadas y el resultado final obtenido tras la validación por parte de los equipos de QA, backend y frontend. Para esta última entrega, muchos de los participantes del equipo han invertido su tiempo en realizar una corrección de errores y bugs que se han ido acumulando a lo largo del ciclo de vida del proyecto. Como son muchos los fallos y mejoras, se presenta un resumen de los mismos:

#### 🔴 Vulnerabilidades Críticas de Seguridad (Backend)
**Falsificación de tokens JWT:** El sistema decodificaba los tokens JWT extrayendo el payload manualmente (base64) sin validar la firma criptográfica, lo que permitía a cualquier atacante forjar un token con identidad arbitraria.
Se implementó la función `_verify_jwt()` en `deps.py` que valida la firma del token mediante `pyjwt.decode()` con el secreto HS256 (`SUPABASE_JWT_SECRET`) y, como fallback, verifica tokens asimétricos (ES256/RS256) contra el JWKS de Supabase vía `client.auth.get_claims()`, rechazando cualquier token con firma inválida o expirada.


**API sin protección en transcripciones:** El endpoint `/api/minutes/transcribe` no requería autenticación, permitiendo que cualquier usuario anónimo subiera archivos de audio masivos y generara actas en cualquier comunidad sin restricción.
Se añadió la dependencia `get_current_user` al endpoint para exigir un JWT válido, y se incorporó `verify_association_admin_or_president()` para verificar que el usuario autenticado sea Administrador o Presidente de la comunidad objetivo antes de permitir la transcripción.

**CORS excesivamente permisivo:** La configuración CORS utilizaba `allow_origins=["*"]`, lo que permitía a cualquier sitio web externo realizar llamadas autenticadas a la API en nombre del usuario.
Se sustituyó el wildcard por una lista explícita de orígenes permitidos en `main.py`, incluyendo únicamente los dominios de producción en Render (`vecinus-s1/s2/s3`, `vecinus-ppl`, `vecinus`), la URL base de la app (`APP_BASE_URL`) y los orígenes de desarrollo local.

**Filtración de datos internos:** Los mensajes de error devolvían detalles internos como nombres de constraints de la base de datos (`profiles_username_key`), códigos de error Supabase y trazas de excepciones, facilitando a un atacante el mapeo del esquema interno.
Se envolvieron los bloques `except` de los endpoints con mensajes de error genéricos orientados al usuario (e.g. `"Error interno al registrar"`, `"Error al eliminar la incidencia"`) y se movió el detalle técnico a logs internos mediante `logger.error()`, evitando exponer información sensible en las respuestas HTTP.

#### 🟠 Autorización, Roles y Validaciones
**Problemas con el rol de Presidente:** El sistema no otorgaba al Presidente (rol 4) los mismos permisos de visualización de incidencias descartadas y de borrado que al Administrador (rol 1), provocando discrepancias en la interfaz.
Se actualizaron las comprobaciones de rol en `incidents.py` para incluir `is_president = user_role == "4"` junto a `is_admin`, y en el endpoint de borrado (`discard_incident`) se amplió la condición de autorización a `role not in {"1", "4"}`, igualando los permisos del Presidente con los del Administrador.

**Ausencia de límites en campos de texto:** Múltiples esquemas carecían de longitud máxima en campos como nombres de usuario, contenido de chat y descripciones, lo que podía romper la interfaz y permitir entradas maliciosas de tamaño arbitrario.
Se añadieron restricciones `max_length` con `Field()` de Pydantic en todos los esquemas afectados: chat (`max_length=2000`), incidencias (`max_length=2000`), comunidades (`name max_length=120`, `address max_length=250`), anuncios (`max_length=200`), título de actas (`max_length=120` vía `Query`), y feedback (`max_length=2000`).

**Validación deficiente de archivos:** Las actas solo validaban el `content_type` enviado por el cliente (fácilmente falsificable) y además cargaban el archivo completo en memoria antes de comprobar si excedía el tamaño máximo.
Se implementó una lectura progresiva por chunks de 1 MB en `minutes.py`, comprobando el tamaño acumulado contra `MAX_FILE_SIZE` (150 MB) en cada iteración y liberando la memoria inmediatamente (`del audio_chunks`) si se supera el límite, además de restringir los `content_type` a un conjunto explícito de formatos de audio (`ALLOWED_CONTENT_TYPES`).

**Duplicidad de comunidades:** El backend no verificaba si ya existía una comunidad con la misma dirección antes de crear una nueva, permitiendo registros duplicados que causaban confusión en la gestión.
Se añadió una consulta previa en `create_community()` que busca en `neighborhood_associations` si ya existe un registro con la misma `address`, devolviendo un error HTTP 409 con el mensaje `"Ya existe una comunidad con esa dirección"` antes de proceder con la inserción.

#### 🟡 Frontend: Rendimiento, Seguridad y Configuración
**Almacenamiento inseguro de datos:** La información del usuario, sus roles y el token JWT se almacenaban en `AsyncStorage` en texto plano, quedando accesibles si el dispositivo era comprometido.
Se migró el almacenamiento del token JWT a `expo-secure-store` (`SecureStore.setItemAsync`/`getItemAsync`) en plataformas nativas (iOS/Android), manteniendo `AsyncStorage` como fallback únicamente para la versión web donde SecureStore no está disponible, según la lógica `Platform.OS === 'web'` del `storage.service.ts`.

**Caída silenciosa a entorno local:** Si la variable de entorno `EXPO_PUBLIC_BACKEND_URL` no estaba configurada en producción, la aplicación caía silenciosamente a `localhost:8000`, rompiendo completamente la funcionalidad para los usuarios finales.
Se modificó `getBackendUrl()` en `client.ts` para que el fallback a `localhost` solo se aplique en modo desarrollo (`__DEV__`), lanzando un `Error('EXPO_PUBLIC_BACKEND_URL is required in production')` explícito en producción si la variable no está definida.

**Llamadas en serie ineficientes:** El proceso de login ejecutaba tres peticiones HTTP de forma secuencial (login, perfil y comunidades), incrementando innecesariamente el tiempo de carga tras autenticarse.
Se refactorizaron las llamadas post-login en `auth.ts` y `user.ts` para ejecutar las peticiones de perfil (`/users/me`) y comunidades (`/users/me/communities`) en paralelo mediante `Promise.all()`, reduciendo el tiempo total de carga al solapar ambas consultas de red.

**Fugas de información visual en el chat:** Al cambiar de comunidad, los mensajes del chat anterior se mostraban momentáneamente antes de que se cargaran los nuevos datos, provocando una fuga visual confusa para el usuario.
Se añadió un `useEffect` en `chat.tsx` (línea 284-289) que resetea inmediatamente el estado al cambiar `resolveChannel`: ejecuta `setMessages([])`, `setChannel(null)` y `setState('loading')` antes de resolver el nuevo canal, eliminando cualquier vestigio visual del chat anterior.

#### 🟢 Deficiencias Funcionales y de Experiencia de Usuario (UX)
**Errores en borrado de incidencias:** El botón de eliminar incidencia aparecía para usuarios sin permisos suficientes, mostrando un error de autorización 403 al pulsarlo en lugar de ocultarse preventivamente.
Se corrigió la lógica de visibilidad del botón en el frontend para que solo se renderice cuando el usuario es Administrador, Presidente o propietario de la incidencia, y en el backend se amplió `discard_incident()` para verificar `verify_own_incident()` además del rol, permitiendo al propietario borrar sus propias incidencias.

**Conflictos al escanear códigos QR:** El escáner QR sufría problemas de concurrencia al leer el código dos veces seguidas antes de que la validación del primero finalizara, provocando errores duplicados engañosos en el backend.
Se implementó un mecanismo de triple bloqueo en `scanner.tsx` usando un `useRef(scanningLock)` combinado con los estados `scanned` e `isValidating`, que impide cualquier nuevo escaneo hasta que la petición de validación del QR anterior haya finalizado y el usuario pulse explícitamente "Escanear de nuevo".

**Experiencia pobre en el chat:** El cuadro de texto del chat ocultaba mensajes al redimensionarse dinámicamente, faltaba el atajo de teclado "Enter" para enviar mensajes en la versión web, y el Presidente tenía bloqueado el acceso a su propio chat comunitario.
Se implementó un compositor con altura dinámica controlada (`CHAT_COMPOSER_MIN_HEIGHT`/`MAX_HEIGHT`) y scroll automático al fondo (`scrollToBottom`), se añadió el handler `onKeyPress` que detecta `Enter` sin `Shift` en `Platform.OS === 'web'` para enviar mensajes, y se incluyó al Presidente en la función `isAdminOrPresident()` usada en `resolveChannel()` para permitirle crear y acceder al canal de chat.

**Flujo de registro roto:** Al confirmar el correo electrónico tras registrarse, el usuario era redirigido a una URL de confirmación inexistente en la SPA, mostrando una página de error en lugar de la pantalla de login.
Se corrigió la URL de redirección post-confirmación en la configuración de Supabase para que apunte a la ruta de login de la aplicación (`/(auth)/sign-in`), y en el backend el endpoint de registro devuelve `needs_email_confirmation` para que el frontend muestre un mensaje informativo indicando que revise su correo antes de poder iniciar sesión.

**Actualización manual requerida:** Al aceptar la invitación a una comunidad desde la pantalla de invitaciones, el usuario debía refrescar manualmente la pestaña para ver la nueva comunidad reflejada en el menú lateral.
Se añadió la llamada `await refreshUserContext()` en el handler `handleAccept()` de `invitations.tsx` inmediatamente después de `acceptInvitation.mutateAsync()`, lo que actualiza automáticamente el contexto de autenticación (incluyendo la lista de comunidades) sin necesidad de recargar la página.


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