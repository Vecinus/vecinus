
### 2.2 Validación de longitud de campos no centralizada

- **Ubicación:** `backend/schemas/incidents/*.py`, `backend/schemas/announcements/*.py`, `backend/schemas/alerts/*.py`, `backend/schemas/minutes/*.py`
- **Descripción:** Múltiples schemas Pydantic no imponen `max_length` en campos de texto libre (`title`, `description`, `content`). El frontend valida algunas cotas (50 caracteres en nombre de zona, por ejemplo), pero el backend acepta strings arbitrariamente largos.
- **Implicaciones:**
  - T-13: validación inconsistente entre cliente y servidor → un atacante con `curl` puede saltarse límites UX.
  - T-10: si se llegan a límites de base de datos, el endpoint puede devolver 500 en lugar de 4xx informativo.
- **Severidad:** Alta
- **Solución propuesta:** Añadir `Field(..., max_length=N)` en cada schema. Ejemplo:
  ```python
  title: str = Field(..., min_length=3, max_length=120)
  content: str = Field(..., min_length=1, max_length=5000)
  ```

### 2.3 Endpoints de chat: confiar en mocks reales tras eliminación de DM blocking

- **Ubicación:** `backend/tests/chat/test_chat.py:262-266` y `frontend/api/chat.ts`
- **Descripción:** El test `test_send_message_blocked_direct_message_rejected` y la entrada `mock_dm_blocked_by_me` del fixture todavía dependen de la columna `is_blocked` que se eliminó del schema en una iteración anterior (después revertida por cambio de rama). La rama actual `fix/recarga` retiene la lógica, pero conviene verificar consistencia.
- **Implicaciones:** Si en producción ya no existe la columna `is_blocked`, los tests pasarán contra mocks pero fallarán contra Supabase real → T-11 (crash en demo).
- **Severidad:** Alta
- **Solución propuesta:**
  1. Confirmar que las migraciones de Supabase aún contienen `is_blocked` y `blocked_by` en `chat_channels`, o
  2. Eliminar la prueba y los mocks asociados si se eliminó la columna.

### 2.4 Manejo silencioso de HTTP 402 (suscripción)

- **Ubicación (13 archivos):**
  - `frontend/app/_layout.tsx`
  - `frontend/api/client.ts`
  - `frontend/lib/payment-events.ts`
  - `frontend/hooks/useAnnouncements.ts`
  - `frontend/app/(drawer)/[communityId]/anuncios.tsx`
  - `frontend/app/(drawer)/[communityId]/anuncio/[id].tsx`
  - `frontend/app/(drawer)/[communityId]/chat.tsx`
  - `frontend/app/(drawer)/[communityId]/chatbot.tsx`
  - `frontend/app/(drawer)/[communityId]/actas/index.tsx`
  - `frontend/app/(drawer)/[communityId]/votaciones/index.tsx`
  - `frontend/app/(drawer)/[communityId]/votaciones/create.tsx`
  - `frontend/app/(drawer)/[communityId]/votaciones/edit.tsx`
  - `frontend/app/(drawer)/[communityId]/votaciones/[pollId].tsx`
- **Descripción:** Diferentes pantallas detectan 402 con patrones distintos (algunas redirigen al paywall, otras silencian el error). No hay un interceptor único en `api/client.ts` que normalice el comportamiento.
- **Implicaciones:** T-12 (comportamiento inesperado) y T-10 (errores HTTP visibles al usuario). Durante la demo, una asociación sin suscripción activa mostrará pantallas vacías en lugar de un mensaje claro.
- **Severidad:** Alta
- **Solución propuesta:** Centralizar en `api/client.ts` un interceptor que, ante 402, emita un evento global escuchado por `payment-events.ts` y muestre un modal único. Eliminar `if (error.response?.status === 402)` repetido en cada pantalla.

## 3. Frontend — validación y experiencia de usuario (T-12, T-13)

### 3.1 Inconsistencia banner vs modal en formularios de zonas comunes

- **Ubicación:**
  - `frontend/components/booking/zone-form.tsx:96-138` (modal `CustomAlertDialog`)
  - `frontend/app/(drawer)/[communityId]/crear-zona.tsx:107-114` (banner `errorMessage`)
  - `frontend/app/(drawer)/[communityId]/editar-zona.tsx:127-137` (banner `errorMessage`)
- **Descripción:** El componente `ZoneForm` valida primero y muestra modal; si los datos pasan esa validación, llaman a `onSubmit`, que a su vez tiene **otra** validación (`validateData`) que muestra un banner rojo encima del formulario. El usuario puede ver dos estilos de error según qué regla falle.
- **Implicaciones:** T-13 (UX confusa, inconsistente). Sólo parcialmente resuelto en commit reciente `36e2b52`.
- **Severidad:** Media
- **Solución propuesta:** Unificar la validación en `ZoneForm` (lo hace ya con `handleSubmit`) y eliminar las funciones `validateData` duplicadas en `crear-zona.tsx` y `editar-zona.tsx`. Confiar en el modal del propio form.

### 3.2 Validación de `max_guests_per_reservation` inconsistente entre crear y editar

- **Ubicación:**
  - `crear-zona.tsx:89` permite `guests < 0` y "cero o positivo".
  - `editar-zona.tsx:72` exige `>= 1`.
- **Descripción:** Crear permite 0 invitados; editar no. El usuario que crea con `guests=0` no podrá guardar al editar.
- **Implicaciones:** T-12 (comportamiento inesperado) y T-13.
- **Severidad:** Media
- **Solución propuesta:** Alinear ambas validaciones a `>= 1` (coherente con la regla del backend) y mover la validación a `ZoneForm` para tener una sola fuente de verdad.

### 3.3 `ZoneForm`: estado `requiresQr` arrastra valor del registro anterior al crear

- **Ubicación:** `frontend/components/booking/zone-form.tsx:24, 32, 46-63`
- **Descripción:** `defaultRequiresQr` se calcula como `Boolean(initialData.requires_qr)` solo si está definido, pero en `CrearZona` (`crear-zona.tsx:16-24`) el `emptyZona` no define `requires_qr`, así que entra `undefined`. Aceptable, pero al cancelar y volver a entrar, el `useEffect` se dispara solo cuando cambia `initialData.id`. Si el usuario crea, cancela, vuelve a crear, el efecto **no** se redispara (id sigue siendo `0`).
- **Implicaciones:** Bajo riesgo (sólo afecta UX de "Crear → Cancelar → Crear" sin navegar fuera), pero puede dejar valores anteriores visibles.
- **Severidad:** Baja
- **Solución propuesta:** Añadir un `key={zonaId ?? 'new'}` al render del `ZoneForm` desde la pantalla, forzando remontaje cuando se entra a crear.


### 5.3 A verificar (no confirmado en esta auditoría)

Recomendamos revisar manualmente antes del miércoles:
- Endpoints de `incidents`, `polls`, `minutes`, `common_spaces` que reciben `association_id` por path o body — confirmar que SIEMPRE se filtra por la `association_id` del path en queries Supabase, no por la del body.
- `documents` / archivos subidos: verificar que el `bucket` o `path` lleva el `association_id` y que no se sirve sin chequeo de membresía.
