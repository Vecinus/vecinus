# Vecinus — Catálogo Detallado de Errores y Hallazgos

> Documento de contexto técnico para desarrolladores que retoman el proyecto. Recoge todos los errores y hallazgos detectados en la revisión de Sprint 3 (`S3-revision-G05-BE.pdf`), las pruebas de uso de Rares (`Comprobación CU Rares.docx`), la revisión funcional de Hector (`Revision Hector.docx`) y la checklist propia del equipo.
>
> Para cada ítem se indica: **estado actual verificado en el código** (CONFIRMADO / RESUELTO / PARCIAL / NO REPRODUCIBLE), **archivo:línea**, **fragmento de código relevante**, **impacto** y **recomendación de arreglo**.
>
> Fecha de verificación: 2026-05-07. Rama base: `develop`.

---

## Índice

1. [Backend — Seguridad crítica](#1-backend--seguridad-crítica)
2. [Backend — Autorización y RBAC](#2-backend--autorización-y-rbac)
3. [Backend — Validación de entrada y manejo de errores](#3-backend--validación-de-entrada-y-manejo-de-errores)
4. [Backend — Calidad y mantenibilidad](#4-backend--calidad-y-mantenibilidad)
5. [Frontend — Rendimiento](#5-frontend--rendimiento)
6. [Frontend — Seguridad y privacidad](#6-frontend--seguridad-y-privacidad)
7. [Frontend — Configuración](#7-frontend--configuración)
8. [Funcional — Incidencias](#8-funcional--incidencias)
9. [Funcional — Reservas, pases y QR](#9-funcional--reservas-pases-y-qr)
10. [Funcional — Chat](#10-funcional--chat)
11. [Funcional — Chatbot](#11-funcional--chatbot)
12. [Funcional — Actas](#12-funcional--actas)
13. [Funcional — Multicomunidad](#13-funcional--multicomunidad)
14. [Funcional — Registro y creación de comunidad](#14-funcional--registro-y-creación-de-comunidad)
15. [Funcional — UI/UX general](#15-funcional--uiux-general)
16. [Apéndice — Mapeo de roles](#apéndice--mapeo-de-roles)

---

## 1. Backend — Seguridad crítica

### 1.1 JWT sin verificación de firma (CRÍTICO)
- **Estado:** ❌ CONFIRMADO
- **Archivo:** `backend/core/deps.py` — `_extract_jwt_payload` y `get_current_user` (líneas ~70–144)
- **Problema:** El backend decodifica el token en base64 sin validar firma con `python-jose`/`PyJWT`. Cualquier atacante puede forjar un JWT alterando el payload (`sub`, `role`, `email`) y obtener acceso autenticado.
- **Impacto:** Bypass total de autenticación. El servicio `supabase_admin` se usa luego con la identidad falsa, evadiendo RLS.
- **Recomendación:**
  - Verificar la firma con la `JWT_SECRET` del proyecto Supabase (clave HS256).
  - Validar `aud`, `exp` y `iss`. Rechazar con 401 si la verificación falla.
  - O bien delegar la validación a `supabase.auth.get_user(token)` y dejar de manipular el JWT manualmente.

### 1.2 CORS permisivo
- **Estado:** ⚠️ RESUELTO POR ZURITA, REVISAR
- **Archivo:** `backend/main.py:39`
- **Problema:** `allow_origins=["*"]` con `allow_credentials=True` (cuando aplique) y `allow_methods=["*"]`.
- **Impacto:** Cualquier sitio puede llamar a la API desde el navegador del usuario autenticado.
- **Recomendación:** Lista blanca de orígenes (frontend deployado, dominio de Expo Web). Eliminar el comodín para producción.

### 1.3 Filtración de nombres internos / detalles de error
- **Estado:** ❌ CONFIRMADO
- **Archivos:**
  - `backend/api/auth/login.py:65-68` — exposición de `profiles_username_key` y código `23505` en el detail.
  - `backend/api/auth/login.py:87` — `detail=f"Error interno al iniciar sesion: {str(e)}"`.
  - `backend/api/associations/associations.py:98, 342, 382, 500` — patrones equivalentes (`f"Error interno al crear la comunidad: {str(e)}"`, etc.).
  - `backend/api/transcription/minutes.py:63, 127, 147` — ídem.
- **Impacto:** Revela esquema de base de datos, nombres de constraints y stack interno → ayuda a un atacante a mapear el modelo.
- **Recomendación:** Devolver mensajes genéricos (`"Error interno"`) y registrar el `str(e)` solo en logs internos.

### 1.4 Respuestas 500 ante entradas inválidas (no son 4xx)
- **Estado:** ❌ CONFIRMADO en endpoints de transcripción y asociaciones.
- **Archivo:** `backend/api/transcription/minutes.py:60-64, 124-128, 144-148`.
- **Problema:** Cualquier excepción se envuelve en HTTP 500 con detalle interno. La validación correcta debe distinguir input inválido (4xx) de fallo del servidor (5xx).
- **Recomendación:** Validar antes (Pydantic, comprobaciones explícitas) y reservar 500 para errores inesperados.

---

## 2. Backend — Autorización y RBAC

### 2.1 Endpoint `/api/minutes/transcribe` sin autenticación ni RBAC (CRÍTICO)
- **Estado:** ❌ CONFIRMADO
- **Archivo:** `backend/api/transcription/minutes.py:67-131`
- **Problema:** No depende de `get_current_user`. Cualquiera con la URL puede subir un audio de hasta 150 MB y crear un acta en cualquier `association_id`.
- **Impacto:** Bypass completo (el caso 1 de Rares en "Pruebas de backend desde la consola — Inquilino intentando generar un acta").
- **Recomendación:**
  - Añadir `current_user: dict = Depends(get_current_user)`.
  - Verificar que el usuario es Admin (1) o Presidente (4) de la `association_id`.
  - Mismo patrón que `verify_association_admin_or_president` en `common_space.py`.

### 2.3 Listado de incidencias DESCARTADAS solo visible para admin (no presidente)
- **Estado:** ❌ CONFIRMADO
- **Archivo:** `backend/api/incidents/incidents.py:95-96` (y filtros posteriores).
- **Problema:** `is_admin = ... == "1"` se usa para mostrar incidencias en estado `DISCARDED`. El presidente no entra en la lista.
- **Llamada del lado de Hector:** "al presidente no le salen las incidencias rechazadas pero al administrador sí".
- **Recomendación:** Tratar al presidente como admin para visibilidad de incidencias (`role in {"1","4"}`).

### 2.4 Borrado de incidencias: lógica inconsistente y errores
- **Estado:** ❌ CONFIRMADO
- **Archivo:** `backend/api/incidents/incidents.py:282`
  ```python
  if latest_state.get("status") not in {"PENDING", "DISCARDED", "SOLVED"}:
      raise HTTPException(...)
  ```
- **Problemas observados (Hector):**
  - El UI dice que admin/presidente pueden borrar cualquier incidencia, pero solo se permite el borrado al propietario o al admin (no al presidente, ver 2.3).
  - Borrar una incidencia en estado `IN PROGRESS` lanza error.
  - Logs del backend mostraron `Unauthorized` y errores en cierre de sesión tras borrar.
- **Recomendación:**
  - Documentar y simplificar la regla: "puede borrar el creador o cualquier rol Admin/Presidente, sin restricción de estado salvo `IN_PROGRESS` si esa es la regla de negocio".
  - Usar `supabase_admin` (no el cliente con RLS) cuando el actor es admin/presidente.
  - Investigar el error de cierre de sesión: probablemente queda una promesa colgando que dispara un `401` después de invalidar el token.

### 2.5 `get_latest_state` con cliente RLS
- **Estado:** ⚠️ A REVISAR
- **Archivo:** `backend/api/incidents/incidents.py` (función `get_latest_state`).
- **Problema:** Si la consulta del estado se ejecuta con el cliente con RLS (`supabase`) y el actor no es el dueño de la incidencia, podría devolver `None` y romper la lógica posterior (`status_id` indefinido).
- **Recomendación:** Cuando el actor sea admin/presidente, usar `supabase_admin` para `get_latest_state` igual que para el `delete`.

### 2.6 Permisos de subida de fotos en common_space sin verificación de imagen
- **Estado:** ⚠️ PARCIAL
- **Archivo:** `backend/api/common_space/common_space.py:40-54`
- **SOLUCION:** Quitar el poder subir una foto a las zonas comunes, vamos a eliminar esa opcion 

### 2.7 Multicomunidad — endpoints administrativos repiten lógica
- **Estado:** ⚠️ MANTENIBILIDAD
- **Archivo:** `backend/api/associations/associations.py:619-630, 668-679, 713-726`
- **Problema:** El patrón "consultar memberships → comprobar role in [1,4]" se repite N veces. Riesgo de inconsistencia entre endpoints (alguno se olvida del 4, ya ocurrió en chat_helpers).
- **Recomendación:** Extraer helper único `require_role(association_id, user_id, allowed_roles)` y reutilizar.

---

## 3. Backend — Validación de entrada y manejo de errores

### 3.1 Schemas sin `max_length` ni saneamiento
- **Estado:** ❌ CONFIRMADO
- **Archivos:**
  - `backend/schemas/auth/auth.py` — `username` sin `max_length`.
  - `backend/schemas/chat/chat.py` — `content` de mensaje sin `max_length`.
  - `backend/schemas/incidents/incidents.py` — `description` sin `max_length`.
  - `backend/schemas/associations/associations.py:70-72` — `CreateCommunityRequest` (`name`, `address`) sin validadores.
- **Síntomas reales:**
  - Hector: "cuando pones un nombre extremadamente largo ni siquiera puedes apretar el botón… si el texto tiene varias líneas, se sale del botón".
  - Rares: "no hay límite máximo de caracteres para un mensaje".
- **Recomendación:**
  ```python
  name: str = Field(min_length=2, max_length=120, pattern=r"^[\w\s\-.,áéíóúÁÉÍÓÚñÑ]+$")
  ```

### 3.2 Sin comprobación de duplicados al crear comunidad
- **Estado:** ❌ CONFIRMADO
- **Archivo:** `backend/api/associations/associations.py:49-98`
- **Problema:** No se verifica si ya existe una comunidad con el mismo `(name, address)`. Hector reporta poder crear dos comunidades idénticas.
- **Recomendación:** Crear constraint UNIQUE en la base de datos para address.

### 3.3 Validación de tipo de archivo de actas insuficiente
- **Estado:** ⚠️ PARCIAL
- **Archivo:** `backend/api/transcription/minutes.py:15-24, 79-83`
- **Problema:** El backend rechaza con 415 si el `content_type` no está en la whitelist, pero:
  1. El error se transforma en 500 si la transcripción luego falla (línea 124-128 captura todo).
  2. El usuario reporta "no se pudo cargar el audio" cuando subes un no-audio: error genérico, no diferenciado.
- **Recomendación:**
  - Validar también extensión real con `magic`/`puremagic` (el `content_type` lo manda el cliente).
  - Mensajes específicos: "Formato no soportado", "El archivo está corrupto", "Excede 150 MB".

### 3.4 Tamaño máximo se valida tras leer todo el fichero en memoria
- **Estado:** ⚠️ EFICIENCIA
- **Archivo:** `backend/api/transcription/minutes.py:85-92`
- **Problema:** `audio_bytes = await audio.read()` carga el fichero entero. Si es 1 GB, se lee primero y luego se descarta. Vector de DoS por agotamiento de memoria.
- **Recomendación:** Leer en chunks de 1 MB y abortar al superar `MAX_FILE_SIZE`. Existe `request.headers.get("content-length")` para una preverificación.

### 3.5 No se muestra el error real de "fuera de horario" al frontend
- **Estado:** ✅ RESUELTO en backend / ⚠️ PARCIAL en UX
- **Archivo:** `backend/services/common_space/reservation_service.py:47-74`
- **Estado actual:** El backend ya rechaza con HTTP 400 si la reserva queda fuera del horario de la zona común (verificado contra el caso #4 de Rares). El frontend debería mostrar el mensaje del `detail` directamente.

### 3.6 Validación de coincidencia entre QR y zona común al escanear
- **Estado:** ⚠️ PARCIAL
- **Archivo:** `backend/services/common_space/reservation_service.py:296-352`, `guest_pass_service.py:194-254`
- **Problema:** El backend valida que el QR pertenece a la `active_association_id`, pero no a una zona específica. El scanner es genérico por comunidad. Hector reporta "Pase de piscina escaneado en gimnasio: aparece acceso permitido pero el backend devuelve 400" — síntoma de doble lectura del barcode antes de actualizar el estado React (`scanned`).
- **Recomendación frontend (scanner.tsx:27-31):**
  ```ts
  if (scanned || isValidating) return;
  setScanned(true);     // mover ANTES de await para evitar doble disparo
  setIsValidating(true);
  ```
  Y en backend, considerar añadir `expected_space_id` opcional al payload de validación si se quiere ligar a un punto físico.

---

## 4. Backend — Calidad y mantenibilidad


### 4.2 `print(...)` y debugging residual en código
- **Estado:** ⚠️ A REVISAR
- **Recomendación:** Sustituir por `logging` con niveles, eliminar `print` de rutas calientes.


---

## 5. Frontend — Rendimiento

### 5.1 Login con tres llamadas secuenciales
- **Estado:** ❌ CONFIRMADO
- **Archivo:** `frontend/api/auth.ts` — `useLoginMutation` (líneas ~89-103)
- **Problema:** `login → fetchProfile → fetchCommunities` corren en serie cuando podrían paralelizarse las dos últimas con `Promise.all` (de hecho `fetchUserWithCommunities` ya lo hace, pero no se usa aquí).
- **Recomendación:**
  ```ts
  const [profile, communities] = await Promise.all([
    authApi.getProfile(token),
    authApi.getCommunities(token),
  ]);
  ```

### 5.2 Re-renders por contexto monolítico de `AuthContext`
- **Estado:** ⚠️ A REVISAR
- **Recomendación:** Dividir en `AuthContext` (token, user) y `CommunityContext` (active community, role). Reducir prop-drilling en pantallas tipo `chat.tsx` y `incidencias.tsx`.

### 5.3 `FlatList` sin `getItemLayout` ni `keyExtractor` estable en chat
- **Archivo:** `frontend/app/(drawer)/[communityId]/chat.tsx:369-396`
- **Recomendación:** En historiales largos, añadir `getItemLayout` y `removeClippedSubviews={true}` para evitar saltos.

---

## 6. Frontend — Seguridad y privacidad

### 6.1 Datos de usuario y comunidades en `AsyncStorage`
- **Estado:** ❌ CONFIRMADO
- **Archivo:** `frontend/api/services/storage.service.ts`
- **Problema:** Solo el token usa `SecureStore` (en nativo). El objeto `User` y `CommunitiesAndRole` siempre se persisten en `AsyncStorage`, accesible para cualquier app con acceso al sandbox o por root.
- **Recomendación:** Mover datos sensibles de usuario también a `SecureStore` en native; en web, mantener `localStorage` pero cifrar con `crypto.subtle` y clave derivada del token.

### 6.2 Mensajes momentáneos del chat anterior al cambiar de usuario/comunidad
- **Estado:** ❌ CONFIRMADO (Rares)
- **Archivo:** `frontend/app/(drawer)/[communityId]/chat.tsx:147-202`
- **Problema:** Al cambiar de comunidad, `messages` y `channel` no se limpian inmediatamente; el `useEffect` se reejecuta pero hay un flash con datos antiguos.
- **Recomendación:**
  ```ts
  React.useEffect(() => {
    setMessages([]);
    setChannel(null);
    setState('loading');
    void resolveChannel();
  }, [normalizedCommunityId, resolveChannel]);
  ```

### 6.3 Validación de email solo del lado del backend en invitaciones
- **Estado:** ❌ CONFIRMADO
- **Archivo:** `frontend/app/(drawer)/[communityId]/admin.tsx:369-376`
- **Problema:** El input no valida formato de email; al enviar uno inválido, sale "Something went wrong" / React error #31.
- **Recomendación:** Validar con regex/`zod` antes del submit y deshabilitar el botón si no es un email válido.

### 6.4 No hay límite de caracteres en inputs cliente
- **Estado:** ❌ CONFIRMADO
- **Archivos:**
  - `frontend/components/sign-up-form.tsx` — username sin `maxLength`.
  - `frontend/components/actas/create-acta-card.tsx:170-177` — title sin `maxLength`.
  - `frontend/app/(drawer)/[communityId]/chat.tsx:410-428` — textarea de mensaje sin tope.
- **Recomendación:** Añadir `maxLength={120}` en inputs y `maxLength={2000}` en mensajes (ajustar según schema backend).

### 6.5 Pruebas IDOR/Spoofing/Sin token sobre el chat
- **Estado:** ✅ RESUELTO según Rares (REVISAR).
- **Notas:** El backend extrae el `user_id` del token y descarta cualquier `user_id` del payload; rechaza con 401 sin Bearer; valida pertenencia a la comunidad. **Mantener cobertura con tests automatizados** para evitar regresiones.

---

## 7. Frontend — Configuración

### 7.1 Fallback `localhost` en producción
- **Estado:** ❌ CONFIRMADO
- **Archivo:** `frontend/api/client.ts:5-11`
- **Problema:** Si la variable `EXPO_PUBLIC_API_URL` no está definida, se cae a `http://localhost:8000`. En un build de producción esto rompe la app silenciosamente.
- **Recomendación:**
  ```ts
  const baseURL = process.env.EXPO_PUBLIC_API_URL;
  if (!baseURL) throw new Error('EXPO_PUBLIC_API_URL is required');
  ```


### 7.3 Logging verboso en producción
- **Estado:** ⚠️ A REVISAR
- **Recomendación:** Envolver `console.log` en `if (__DEV__)` o eliminar. Exponer logs a una librería tipo Sentry.

---

## 8. Funcional — Incidencias

### 8.1 Botón de borrar visible para usuarios sin permiso JESUS ORIA
- **Estado:** ✅ RESUELTO
- **Archivo:** `frontend/app/(drawer)/[communityId]/incidencias.tsx:311-313`
  ```ts
  const canDeleteThis = ['PENDING', 'SOLVED', 'DISCARDED'].includes(status);
  ```
- **Problema:** No comprueba propiedad del usuario sobre la incidencia. El botón aparece y al pulsar el backend devuelve `Unauthorized` (lo que reporta Hector). Además, los usuarios no pueden eliminar las incidencias que ellos mismos crearon.
- **Recomendación:**
  ```ts
  const canDeleteThis =
    (incident.creator_id === user.id || isAdminOrPresident) &&
    ['PENDING','SOLVED','DISCARDED'].includes(status);
  ```

### 8.2 Estado `IN PROGRESS` no deletable (confuso) JESUS ORIA
- **Estado:** ✅ RESUELTO
- **Recomendación:** Permitir el borrado por admin en cualquier estado, o mostrar al usuario explícitamente "no se puede eliminar incidencias en curso".

### 8.3 Error en backend tras logout post-delete
- **Estado:** ❌ REPORTADO (Hector). Investigar.
- **Hipótesis:** Una `subscription` o `interval` sigue ejecutándose tras logout y dispara una petición con token inválido → 401. Auditar `useEffect` cleanups en `incidencias.tsx`.

---

## 9. Funcional — Reservas, pases y QR

### 9.1 Crear zona común — error CORS reportado por Hector
- **Estado:** ⚠️ A REPRODUCIR
- **Archivo:** `backend/api/common_space/common_space.py:57-66`
- **Notas:** El backend está implementado correctamente. Verificar que el frontend manda `Origin` válido y que `main.py` no está rechazando el preflight. **Probable causa:** el `allow_origins=["*"]` con `allow_credentials=True` falla en preflight según la spec CORS — al cerrar el comodín hay que añadir el origen real de Expo Web.

### 9.2 Desplegable de zonas comunes de reservas vacío hasta recargar JESUS ORIA
- **Estado:** ✅ RESUELTO
- **Archivo:** `frontend/app/(drawer)/[communityId]/...` (posible `reservas.tsx` o componente de filtros de zonas comunes)
- **Problema:** Al entrar en la pantalla de reservas, el desplegable de selección de zona común aparece vacío hasta que se recarga la página. Después de refrescar, la lista se carga correctamente.
- **Impacto:** Experiencia de usuario rota; el usuario no puede seleccionar zona común en su primer acceso.
- **Recomendación:** Inspeccionar el estado inicial y la carga de datos en el componente de reservas. Asegurar que la lista de zonas comunes se inicializa con la consulta correcta y no depende solo de un efecto posterior a la renderización.

### 9.3 Network error reservando la barbacoa JESUS ORIA
- **Estado:** ✅ RESUELTO
- **Archivo:** `frontend/app/(drawer)/[communityId]/...` (posible `reservas.tsx` o servicio de reservas)
- **Problema:** La reserva de la barbacoa falla con `Network error`, mientras que el resto de zonas comunes funciona correctamente.
- **Impacto:** Bloqueo de uso de la zona de barbacoa, pérdida de confianza en el sistema de reservas.
- **Recomendación:** Revisar la petición específica enviada al reservar la barbacoa. Comparar payload y endpoint con otras zonas comunes; corregir posibles IDs, parámetros de request o validaciones de backend que solo afectan a esta zona.

### 9.5 QR escaneado para día futuro lanza 400 confuso
- **Estado:** ⚠️ PARCIAL (Hector)
- **Archivo:** `backend/services/common_space/reservation_service.py:327-331`
- **Problema:** El frontend muestra un aviso ("no es posible escanear futuros"), pero también golpea al backend que devuelve 400 con detail "no es válido para hoy".
- **Recomendación:** El frontend debería evitar la llamada cuando ya sabe que es un QR de fecha futura (información del propio QR si se mete fecha en el payload). Reduce ruido y latencia.

### 9.6 QR de zona X validado escaneando en zona Y
- **Estado:** ⚠️ Kevin
- **Archivo:** `frontend/app/(drawer)/[communityId]/scanner.tsx:27-77`
- **Hipótesis:** El scanner muestra "Acceso Permitido" porque el primer escaneo fue válido (mismo community), pero un segundo escaneo casi simultáneo dispara el 400 que aparece en el log del backend. La protección `if (scanned || isValidating) return;` está antes del `setScanned(true)`, así que React no actualiza estado entre dos lecturas seguidas del mismo frame.
- **Recomendación:** Añadir `useRef` lock síncrono:
  ```ts
  const scanningLock = useRef(false);
  if (scanningLock.current) return;
  scanningLock.current = true;
  ...
  ```

---

## 10. Funcional — Chat --> Alejandro

### 10.1 Cuadro de texto recortado al redimensionar hacia arriba
- **Estado:** ❌ CONFIRMADO (Rares)
- **Archivo:** `frontend/app/(drawer)/[communityId]/chat.tsx:413-426`
- **Problema:** `composerHeight` solo crece cuando `onContentSizeChange` aumenta. El usuario puede arrastrar el `Textarea` (en web es `<textarea>` con `resize` por defecto) hasta tapar el contenido del mensaje.
- **Recomendación:**
  ```ts
  // En el style del Textarea:
  resize: 'none'
  ```
  O fijar altura calculada solamente con `onContentSizeChange`.

### 10.2 Falta atajo Enter / Shift+Enter
- **Estado:** ⚠️ RESUELTO POR ARIEL, REVISAR
- **Recomendación:** En web, capturar `onKeyPress`:
  ```tsx
  onKeyPress={(e) => {
    if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }}
  ```

### 10.3 Sin scroll lateral / barra para chats largos
- **Estado:** ⚠️ Kevin
- **Recomendación:** Añadir botón "scroll to bottom" cuando el usuario sube y aparezcan mensajes nuevos.


### 10.5 Columnas `is_edited` y `updated_at` sin uso real
- **Estado:** ❌ CONFIRMADO (Rares)
- **Recomendación:** Quitar del supabase y del esquema

### 10.6 Presidente no ve el chat de su propia comunidad
- **Estado:** ❌ PREGUNTAR A ARIEL Y KEVIN
- **Archivo:** `frontend/app/(drawer)/[communityId]/chat.tsx:184-189`
  ```ts
  if (!isAdmin) {
    setChannel(null);
    setMessages([]);
    setState('empty');
    return;
  }
  ```
- **Problema:** Solo Admin (rol 1) puede crear el canal. Si nadie lo ha creado, el presidente ve "Chat aún no disponible".
- **Recomendación:** Mejor aún: crear el canal automáticamente al crear la comunidad.

---

## 11. Funcional — Chatbot

### 11.1 El presidente no puede gestionar los documentos del chabot
- **Estado:** ⚠️ RESUELTO POR ARIEL, REVISAR
- **Archivos:** `documents.py, líneas 22-24, 37-38 y 117-120; chat_helpers.py, líneas 48-66; chatbot.tsx, líneas 80-82 y 222-264.`
- **Problema:** Backend y frontend han codificado “gestionar documentos” como permiso exclusivo de rol 1. Eso contradice otros módulos del repo donde admin y presidente comparten capacidades administrativas.
- **Recomendación:** Unificar autorización en un helper único admin_or_president, reutilizarlo en API y UI, y añadir tests de regresión para rol 4 en listar, subir y eliminar documentos. Aquí el fallo no es de interfaz: hoy también fallaría aunque el presidente forzase la petición manualmente.

---

## 12. Funcional — Actas

### 12.2 Mensaje de error al subir formato no soportado RARES N.P
- **Estado:** ⚠️ PARCIAL
- **Archivo:** `frontend/components/actas/create-acta-card.tsx:97-115`
- **Problema:** El `DocumentPicker` filtra con `type: 'audio/*'` pero algunos OS (sobre todo web/Android) permiten saltarse el filtro. Cuando se sube un fichero no audio:
  - El backend devuelve 415 (correcto).
  - El frontend muestra "no se pudo cargar el audio" — genérico.
- **Recomendación:**
  - Validar la extensión y/o el `mimeType` del asset antes de subir.
  - Mostrar mensajes específicos: "Formato equivocado", "Archivo demasiado grande", etc.
  - Whitelist explícita: `['audio/mpeg','audio/wav','audio/x-m4a','audio/mp4','audio/ogg','audio/flac','audio/webm']`.

### 12.3 Falta `maxLength` en input de título  RARES N.P
- **Estado:** ❌ CONFIRMADO
- **Archivo:** `frontend/components/actas/create-acta-card.tsx:170-177`.
- **Recomendación:** `maxLength={120}` y replicar `Field` con validación en backend.

### 12.4 Mensaje "no se pudo cargar el audio" tras grabación  RARES N.P
- **Archivo:** `frontend/components/actas/create-acta-card.tsx:62-85`.
- **Notas:** El callback de `useAudioRecorder` se ejecuta con `result.uri` undefined ocasionalmente en web (Permission denied o stream cerrado). Asegurar mensajes específicos según `result.error`.

---

## 13. Funcional — Multicomunidad

### 13.1 Refresh manual tras aceptar invitación
- **Estado:** ❌ CONFIRMADO (Rares)
- **Notas:** Tras `accept_invitation_internal` el usuario debe salir y volver a entrar de la pestaña Comunidad para ver al nuevo miembro.
- **Recomendación:**
  - Invalidar query de TanStack Query: `queryClient.invalidateQueries(['community-users', associationId])` tras aceptar.
  - O suscribirse al canal Realtime de Supabase para `memberships`.


---

## 14. Funcional — Registro y creación de comunidad

### 14.1 Confirmación de email redirige a página de error
- **Estado:** ❌ CONFIRMADO (Hector)
- **Notas:** "Cuando le doy al correo de confirmación me redirige a la siguiente página pero se confirma el email correctamente". Probable URL de redirect en Supabase Auth apuntando a una ruta inexistente del frontend (`/auth/callback` o similar).
- **Recomendación:**
  - Configurar `Site URL` y `Redirect URLs` en Supabase Auth.
  - Crear pantalla `app/(auth)/confirm.tsx` que confirme y redirija a login con mensaje de éxito.


### 14.3 Botón "Aceptar" no clicable con nombres muy largos
- **Estado:** ❌ CONFIRMADO (Hector)
- **Causa:** Sin `maxLength` y el botón no tiene `flex-shrink: 0`. El texto del nombre desplaza el layout.
- **Recomendación:**
  - `maxLength={120}` en el input.
  - `numberOfLines={1}` y `ellipsizeMode="tail"` en cualquier `<Text>` que muestre el nombre dentro de un botón.

---

## 15. Funcional — UI/UX general


### 15.2 Errores 4xx genéricos sin descripción
- **Estado:** ⚠️ A REVISAR
- **Recomendación:** Centralizar el formateo de errores en un helper (`formatApiError(err)`) y reusarlo en alertas. Distinguir 400 (input), 401 (auth), 403 (permisos), 413 (tamaño), 415 (formato), 500 (interno).

---

## Apéndice — Mapeo de roles

| ID | Nombre        | Permisos típicos                          |
|----|---------------|-------------------------------------------|
| 1  | Administrador | Total — gestión de comunidad y miembros   |
| 2  | Propietario   | Reservar, ver, invitar inquilinos         |
| 3  | Inquilino     | Reservar, ver                             |
| 4  | Presidente    | **Debería** equivaler a Admin en su comunidad |
| 5  | Empleado      | Validar QR, escanear accesos              |

---

## Resumen ejecutivo de prioridades

| Severidad   | Items                                                               |
|-------------|---------------------------------------------------------------------|
| 🔴 Crítica   | 1.1 (JWT), 2.1 (transcribe sin auth), 1.2 (CORS), 1.3 (leak)        |
| 🟠 Alta      | 2.2/2.3/2.4 (presidentes), 3.1/3.2 (validación), 8.1/8.3 (incidencias), 14.1 (redirect) |
| 🟡 Media     | 5.1 (login serial), 6.1 (storage), 6.2 (chat flash), 9.1 (CORS preflight), 10.6 (chat presi) |
| 🟢 Baja      | 4.x (refactors), 7.3 (logs), 9.4 (photo_url), 13.2 (rol IDs)        |

---

*Documento generado a partir de la verificación cruzada del código en `develop` con los reportes de `Errores.txt`, `Comprobación CU Rares.docx`, `Revision Hector.docx` y `S3-revision-G05-BE.pdf`. Revisar y actualizar cuando se cierre cada hallazgo.*
