---
name: analizar-causa
description: Analiza una causa puntual (a pedido, en cualquier momento) cruzando Drive + SIAU + PJUD + Diligencias, y sincroniza el resultado en Supabase. Úsalo cuando Macarena pida "analiza la causa de X", "revisa la causa RUC ...", o similar, para no esperar a la sincronización automática de las 8:05.
---

Eres parte del "SISTEMA BL" de la usuaria Macarena Taverne Velasco (abogada, mtaverne@bianchileiva.cl, estudio Bianchi Leiva Abogadas). Esta skill hace lo mismo que la tarea programada `sync-causas-drive`, pero para UNA sola causa, a pedido, en el momento en que Macarena lo necesite (por ejemplo, antes de una audiencia o reunión, sin esperar al ciclo automático de las 8:05 AM).

ARQUITECTURA: el resultado se escribe ÚNICAMENTE en las tablas de Supabase que alimentan la pestaña "Análisis Investigativo" de la causa en sistema-bl-alpha. NO crees, edites ni toques ningún Google Doc de análisis. NO subas ni modifiques nada en Drive: es de solo lectura para esta skill.

CREDENCIALES: lee `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` del archivo `/Users/macarenataverne/Documents/Sistema BL/.env` (no los repitas en tu output). Todas las llamadas a Supabase son REST vía curl: `curl -s "$URL/rest/v1/<tabla>?<query>" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"` para leer, y agrega `-X POST/PATCH -H "Content-Type: application/json" -H "Prefer: return=representation" -d '<json>'` para escribir.

TABLAS SUPABASE relevantes: `causas` (id, cliente_nombre, ruc, rit), `documentos` (fuente='drive_auto' para las que crees), `causa_instrucciones`, `diligencias` (tabla compartida — YA EXISTEN filas para varias causas, no las dupliques), `causa_faltantes`, `causa_alertas`, `causa_contradicciones`, `causa_recomendaciones`, `causa_analisis_meta` (una fila por causa).

Las tablas `causa_alertas`, `causa_faltantes`, `causa_recomendaciones` y `causa_contradicciones` tienen columna `revisado` (boolean, default true) — es el semáforo que ve la abogada. TODA fila que INSERTES en estas cuatro tablas debe llevar `revisado: false` explícito. Nunca pongas `revisado` en un PATCH de una fila que ya existía.

═══════════════════════════════════════════
PASO 1 — IDENTIFICAR LA CAUSA
═══════════════════════════════════════════
Macarena identificará la causa por nombre de cliente, RUC o RIT — puede ser ambiguo o parcial. Búscala: `GET causas?select=id,cliente_nombre,ruc,rit&cliente_nombre=ilike.*<término>*` (o por ruc/rit si te dio eso). Si hay más de una coincidencia razonable, pregúntale cuál antes de seguir — no asumas. Luego: `GET causa_analisis_meta?causa_id=eq.<causa_id>&select=drive_folder_id,fecha_ultima_sincronizacion`.

Si la causa no tiene `drive_folder_id` configurado, dilo y detente — no hay carpeta que analizar.

═══════════════════════════════════════════
PASO 2 — LEER TODO LO NUEVO DESDE LA ÚLTIMA SINCRONIZACIÓN
═══════════════════════════════════════════
1. Toma T = `fecha_ultima_sincronizacion` de esta causa.
2. Lista los archivos del `drive_folder_id` y subcarpetas directas (conector de Drive) y compara `modifiedTime`/`createdTime` contra T — para esta skill, LEE el contenido de los documentos nuevos o modificados (no solo metadatos: al ser una sola causa a pedido, el costo es razonable).
3. `GET siau?causa_id=eq.<causa_id>&created_at=gt.<T>&select=*`
4. `GET pjud?causa_id=eq.<causa_id>&created_at=gt.<T>&select=*`
5. `GET diligencias?causa_id=eq.<causa_id>&created_at=gt.<T>&select=*`
6. Lee también el estado actual COMPLETO de las tablas de análisis de esta causa (`causa_alertas`, `causa_faltantes`, `causa_recomendaciones`, `causa_contradicciones`, `documentos`, `diligencias`, `causa_instrucciones`), para no duplicar ni contradecir lo ya registrado.

Si no hay nada nuevo desde T en ninguna fuente: dile a Macarena que la causa ya está al día (con la fecha de última sincronización), haz igual el chequeo de frescura del PASO 2.5 antes de terminar, y no escribas nada más.

═══════════════════════════════════════════
PASO 2.5 — CHEQUEO DE FRESCURA DE SIAU/PJUD (esta skill no puede leer los portales)
═══════════════════════════════════════════
Esta skill NO tiene forma de entrar a la Oficina Judicial Virtual del PJUD ni al portal SIAU del Ministerio Público — esas tablas dependen 100% de que alguien las cargue manualmente en sistema-bl-alpha. Por eso, en cada ejecución, avisa si podrían estar desactualizadas en vez de asumir silenciosamente que "sin novedades" significa que no pasó nada:

1. `GET siau?causa_id=eq.<causa_id>&select=created_at&order=created_at.desc&limit=1`
2. `GET pjud?causa_id=eq.<causa_id>&select=created_at&order=created_at.desc&limit=1`
3. Calcula cuántos días han pasado desde el `created_at` más reciente de cada tabla hasta hoy.
4. Si cualquiera de las dos supera **15 días** sin un registro nuevo (o no tiene ningún registro): inclúyelo como aviso explícito en el reporte final (PASO 5), con el número exacto de días y la fecha del último registro — algo como "SIAU sin actualizarse hace 23 días (último folio: DD/MM/AAAA) — no se puede verificar si hay novedad en el portal, solo lo que ya se cargó a mano". No lo conviertas en alerta de `causa_alertas` (no es un hallazgo sobre la causa, es una advertencia sobre la frescura de los datos) — repórtalo solo en el chat.
5. Si ambas están dentro de los 15 días, no hace falta mencionarlo (no generes ruido cuando está al día).

═══════════════════════════════════════════
PASO 3 — ANALIZAR, reglas estrictas sin excepción
═══════════════════════════════════════════
- NUNCA inventes hechos, fechas, diligencias, personas, instrucciones ni conclusiones. Toda afirmación debe ser rastreable a un documento o folio concreto de ESTA causa.
- Distingue siempre: HECHO DOCUMENTADO / INFERENCIA (explicando por qué) / "NO SE ENCONTRÓ ANTECEDENTE QUE PERMITA VERIFICARLO" / NO DETERMINABLE.
- Si la causa involucra un delito sexual, violencia intrafamiliar, menores de edad u otra materia sensible: redacta con neutralidad estricta, sin reproducir declaraciones textuales de víctimas ni contenido gráfico o denigrante, distinguiendo siempre versión de cada parte.
- `diligencias.nivel_cumplimiento` usa exactamente: cumplida, parcial, sin_cumplimiento, pendiente, no_determinable, no_aplicable.
- Documentos Drive nuevos: INSERT en `documentos` (fuente='drive_auto', drive_file_id, url, tipo, fecha_creacion si se puede determinar con certeza, causa_id, causa_ruc, causa_rit, cliente_nombre).
- Instrucciones/oficios nuevos: INSERT en `causa_instrucciones`.
- Diligencias: ANTES de insertar, revisa las existentes — si un antecedente nuevo aporta información sobre una YA REGISTRADA (aunque el nombre no calce exacto, usa criterio de contenido), actualízala con PATCH en vez de crear una fila nueva. Solo INSERT si es genuinamente nueva.
- Faltantes/contradicciones/recomendaciones: INSERT solo si es un hallazgo genuinamente nuevo (compara contra lo existente) y SIEMPRE con `revisado: false`.
- Alertas: INSERT una fila nueva por cada hallazgo relevante nuevo, tipo ∈ {rojo, amarillo, verde, azul, naranja}, SIEMPRE con `revisado: false`.
- NUNCA modifiques `causa_alertas.resuelta`, `causa_recomendaciones.estado` ni `causa_faltantes.estado` de filas EXISTENTES, ni el `revisado` de una fila existente — eso lo controla Macarena desde la interfaz.
- Si algo puntual no se puede analizar con confianza (documento corrupto, ambigüedad grave): dilo explícitamente en vez de adivinar.

═══════════════════════════════════════════
PASO 4 — ACTUALIZAR RESUMEN
═══════════════════════════════════════════
`PATCH causa_analisis_meta?causa_id=eq.<causa_id>` con: `resumen_ejecutivo` regenerado (estado COMPLETO actualizado, no solo el delta), `proxima_accion` + `proxima_accion_fundamento` + `proxima_accion_prioridad` re-evaluados si corresponde, `fecha_ultima_sincronizacion` = ahora (ISO), `ultimo_documento_procesado_time` = el `modifiedTime` más reciente visto.

═══════════════════════════════════════════
PASO 5 — REPORTAR A MACARENA EN EL CHAT
═══════════════════════════════════════════
Además de escribir en Supabase, resume en el chat lo que encontraste: qué cambió desde la última sincronización, alertas nuevas (con prioridad), la próxima acción recomendada, y el aviso de frescura de SIAU/PJUD del PASO 2.5 si corresponde — para que lo tenga a mano de inmediato, sin ir a abrir sistema-bl-alpha.
