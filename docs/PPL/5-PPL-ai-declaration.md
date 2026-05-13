# 5-PPL-ai-declaration

## Declaración de Uso de IA

La Inteligencia Artificial (IA) se ha utilizado en el proyecto Vecinus en **dos roles claramente diferenciados**:

1. **IA integrada como funcionalidad del producto** — componentes de IA que forman parte de la aplicación desplegada y con los que interactúan los usuarios finales (chatbot comunitario y transcripción de actas de juntas).
2. **IA como herramienta de apoyo al desarrollo** — asistentes utilizados por el equipo durante el proceso de ingeniería (generación de código, depuración, documentación, ideación, diseño, etc.).

Ambos roles se han empleado bajo supervisión humana continua. Todo artefacto generado por IA (código, texto, imagen, configuración o respuesta del producto) ha sido revisado, editado y validado por al menos un miembro del equipo antes de integrarse o desplegarse. La responsabilidad final sobre el contenido, el comportamiento y los resultados del proyecto recae íntegramente sobre los autores.

---

## 1. Introducción

A lo largo del desarrollo de este proyecto, el equipo ha utilizado herramientas de IA tanto como parte del producto en sí como un recurso complementario para tareas de ingeniería. Se ha utilizado para acelerar tareas, explorar alternativas y reducir el trabajo repetitivo.

Este documento declara:

- Los modelos y herramientas de IA integrados en el producto Vecinus.
- Los asistentes de IA empleados por el equipo durante el proceso de desarrollo.
- La responsabilidad final del equipo.

---

## 2. IA integrada en el producto Vecinus

Dos funcionalidades del producto Vecinus se apoyan en servicios de IA de terceros. Ambas son visibles en el código fuente de este repositorio.

### 2.1. Chatbot comunitario (Retrieval-Augmented Generation, RAG)

- **Ubicación en el repositorio:**
  - Servicio backend: `backend/services/chatBot/chatBotService.py`
  - Servicio de indexación de documentos: `backend/services/chatBot/documents_ChatBotService.py`
  - Endpoints de la API: `backend/api/chatBot/chatBot.py`, `backend/api/chatBot/documents.py`
  - Cliente en frontend: `frontend/app/(drawer)/[communityId]/chatbot.tsx`

- **Propósito:** Permitir a cualquier miembro de una comunidad realizar preguntas en lenguaje natural sobre los estatutos y normas internas de su comunidad. Los administradores y presidentes pueden subir documentos de contexto (estatutos, reglamentos, actas) que pasan a formar la base de conocimiento del chatbot.

- **Modelos y proveedores:**
  - **LLM:** Google `gemini-2.5-flash` (a través del SDK de Python `google-genai`).
  - **Modelo de embeddings:** Google `gemini-embedding-001`.
  - **Base de datos vectorial:** Pinecone (SDK de Python `pinecone`), con un *namespace* por comunidad para garantizar el aislamiento de datos.

- **Pipeline:**
  1. La pregunta del usuario se embebe con `gemini-embedding-001`.
  2. El vector de consulta se busca en el *namespace* de Pinecone correspondiente a la comunidad.
  3. Se recuperan los 5 fragmentos candidatos con mayor similitud; solo se conservan los que superan el **umbral `CONFIDENCE_THRESHOLD = 0.45`**, y se utilizan como contexto los dos de mayor puntuación (`CONTEXT_LIMIT = 3000` caracteres).
  4. El contexto, el historial de conversación y la pregunta del usuario se envían a `gemini-2.5-flash` junto con un *system prompt* que instruye estrictamente al modelo a responder **únicamente** a partir de los documentos proporcionados y a señalar contradicciones en lugar de inventar información.
  5. Si ningún fragmento supera el umbral, el bot devuelve un mensaje fijo indicando que no se ha encontrado la información, sin llamar al LLM.

- **Mitigaciones de riesgo implementadas en el código:**
  - **Prompt anti-alucinación:** se prohíbe explícitamente al modelo responder fuera del contexto recuperado.
  - **Umbral de confianza (0.45):** las coincidencias con baja similitud se descartan antes de que puedan influir en la respuesta.
  - **Aislamiento por comunidad mediante *namespaces*** en Pinecone, de modo que un usuario nunca puede recibir información de otra comunidad.
  - **Disclaimer obligatorio** añadido a cada respuesta: *"Respuesta meramente informativa basada en estatutos. No sustituye asesoramiento legal."*
  - **Citación de fuentes:** la respuesta de la API incluye los títulos de los documentos utilizados para generarla.
  - **Reintentos con *backoff* exponencial** (`_LLM_MAX_RETRIES = 3`) y **tiempos de espera (30 s)** para evitar una mala experiencia ante errores.
  - **Inicialización perezosa** de los clientes de Pinecone y Gemini para que los tests y la CI no realicen llamadas de red al importar los módulos.

### 2.2. Transcripción de actas

- **Ubicación en el repositorio:**
  - Servicio: `backend/services/transcription/transcription_service.py`
  - Servicios relacionados: `backend/services/transcription/minute_service.py`, `backend/services/transcription/document_service.py`
  - Esquema: `backend/schemas/transcription/minutes.py`
  - Frontend: `frontend/app/(drawer)/[communityId]/actas/` y `frontend/components/actas/`

- **Propósito:** Los presidentes y administradores pueden subir una grabación de audio de una junta de vecinos; el sistema utiliza IA para producir un acta estructurada que contiene: transcripción completa, resumen ejecutivo, temas tratados, acuerdos (con estado APROBADO/DENEGADO) y tareas asignadas (responsable, descripción, fecha límite).

- **Modelo y proveedor:** Google `gemini-2.5-flash` (vía `google-genai`), configurado con `response_mime_type="application/json"`, un esquema JSON estricto (`MINUTES_SCHEMA`) y `temperature=0.1` para favorecer una salida determinista y fiel.

- **Pipeline:**
  1. El audio se escribe en un fichero temporal con la extensión correcta según su tipo.
  2. El fichero se sube a la API de archivos de Gemini; el servicio espera (*polling*) hasta que termine el procesamiento.
  3. Se invoca al modelo con un *prompt* determinista que actúa como "Secretario Jurídico" y con el esquema JSON; la respuesta se parsea al modelo Pydantic `AIGeneratedContent`.
  4. Si el JSON devuelto por Gemini está malformado, una segunda llamada (`_repair_invalid_minutes_json`) pide al modelo que repare el JSON; en caso contrario, se propaga el error de *parsing* original.
  5. El fichero temporal local y el fichero subido a Gemini se eliminan en bloques `finally` independientemente del resultado.

- **Mitigaciones de riesgo implementadas en el código:**
  - **Salida estructurada** forzada mediante `response_schema` de Gemini, de modo que el código posterior nunca tiene que manejar texto en formato libre.
  - **Temperatura baja (0.1)** para reducir la deriva creativa y mantener la transcripción fiel al audio.
  - ***Parsing* defensivo:** el servicio extrae bloques JSON, escapa saltos de línea dentro de cadenas y recurre a una llamada de reparación de JSON antes de lanzar excepciones.
  - **Limpieza automática** de ficheros temporales locales (`os.unlink`) y de los ficheros remotos subidos a Gemini (`files.delete`) para minimizar la retención de datos por terceros.
  - **Humano en el bucle:** el acta generada se presenta al presidente/administrador para revisión y edición **antes** de guardarse como acta oficial; nunca se publica de forma automática.

### 2.3. Datos manejados por la IA del producto

- Los ficheros de audio de las juntas se envían a Google Gemini para su transcripción y se eliminan posteriormente de Gemini.
- Los fragmentos de documentos (estatutos, normas) y las preguntas de los usuarios se envían a Google Gemini para el cálculo de embeddings y la generación de respuestas.
- Los embeddings se almacenan en Pinecone bajo un *namespace* por comunidad.
- Por diseño, no se envían a los proveedores de IA datos de pago, credenciales de autenticación ni identificadores personales; únicamente el contenido textual de los documentos que los administradores de la comunidad suben voluntariamente y los mensajes que los usuarios envían al chatbot.

---

## 3. IA utilizada por el equipo durante el desarrollo

### 3.1. Herramientas utilizadas

| Herramienta | Modelo(s) subyacente(s) | Uso principal en el proyecto |
| --- | --- | --- |
| Claude Code (CLI) | Sonnet/Opus | Generación de código, refactorización, apoyo en depuración, revisión de código y redacción de documentación del repositorio en el entorno local del desarrollador. |
| Claude (web / app) | Claude | Discusiones sobre estilo de código, conversaciones de depuración y exploración de alternativas de diseño. |
| Google Gemini (web) | Gemini 3.1 | Brainstorming, redacción de documentación, mejoras de gramática y tono, explicaciones conceptuales, generación de imágenes ilustrativas para la landing y redes sociales. |
| Sugerencias de GitHub Copilot | Modelos basados en GPT | Únicamente autocompletados de código en línea en el IDE. |


### 3.2. Tareas concretas de desarrollo apoyadas por IA

La siguiente lista resume, por área, el tipo de tareas en las que se han utilizado asistentes de IA. En todos los casos, un miembro del equipo diseñó el *prompt*, revisó la salida, la adaptó a las convenciones del proyecto y fue la persona que finalmente integró el código o el documento.

- **Backend:**
  - Borradores iniciales, esquemas de la base de datos y funciones de servicios.
  - Apoyo en la redacción del pipeline RAG y del pipeline de transcripción.
  - Generación y mejora de casos de prueba con pytest bajo `backend/tests/`.
  - Asistencia con la resolución de `requirements.in` / `requirements.txt` y el flujo de trabajo.

- **Frontend:**
  - Generación de pantallas, componentes y hooks bajo `frontend/app/` y `frontend/components/`.
  - Apoyo para entender la interacción entre Expo Router y React Query en este proyecto.
  - Sugerencias y mejoras de accesibilidad.

- **DevOps / CI:**
  - Guía para configurar los *workflows* y los *hooks* de lint/formato declarados en `.github/`.

- **Documentación y presentación:**
  - Revisiones estilísticas de los entregables de Sprint bajo `docs/`, incluyendo gramática, tono y estructura.
  - Brainstorming de nombres, lemas, descripciones comerciales y estilo visual para la landing page.
  - Generación de ilustraciones de estilo utilizadas en presentaciones y banner publicitario.

---

## 4. Responsabilidad final

El equipo confirma que:

- La versión final del proyecto refleja sus propias decisiones, criterios y proceso de validación.
- Todo contenido generado por IA incluido en el código o en los documentos ha sido revisado y aprobado por al menos un miembro del equipo.
- A ninguna herramienta de IA se le ha otorgado capacidad de decisión sobre el proyecto; la IA se ha utilizado estrictamente como recurso de apoyo.
- Cualquier error, bug o inexactitud presente en el proyecto es responsabilidad de los autores, independientemente de si el fragmento afectado fue redactado originalmente con la ayuda de un asistente de IA.
