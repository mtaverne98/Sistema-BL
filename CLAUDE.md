# Sistema BL

Sistema de gestión de causas del estudio Bianchi Leiva Abogadas (Las Condes,
Santiago). Uso interno, una sola usuaria: Maca, abogada litigante en materia
penal, familia, policía local y consumo.

El sistema reemplaza una planilla Excel. La prioridad es que sirva en el día a
día del litigio: rápido de anotar, fácil de revisar, sin fricción.

## Stack

- React + Vite + Tailwind
- Supabase (Postgres) — proyecto `zzcdkjoetgclbtcuqswr`
- Deploy en Vercel → sistema-bl-alpha.vercel.app
- Repo: `mtaverne98/Sistema-BL`

## Estética

- Sidebar: `#1A2E4A`
- Acento: `#2570BA`
- Fondos: blanco y gris muy claro (`#F5F6F8`)
- Chips de estado: verde `#1E9E6A`, ámbar `#C8862B`, rojo `#C0392B`
- Tipografía del sistema, sin fuentes externas
- Bordes suaves (`#E3E7EC`), radios de 6–10px
- Sobrio, denso en información, sin decoración innecesaria

## Convenciones de interfaz

Estos patrones ya existen en el sistema y hay que reutilizarlos, no reinventarlos:

- **Edición inline por doble clic** en celdas de tabla (patrón de SIAU y PJUD)
- **Botón copiar** en RIT, RUC y folios
- **Vista expandida en el lugar**: la fila se abre con borde izquierdo azul y
  fondo gris claro, con propiedades en dos columnas y texto libre debajo
  separado por línea punteada
- **Chips de estado** con color, nunca solo texto
- **Filtros con contador** arriba de las listas
- **Enter guarda** en toda entrada rápida, y deja el cursor listo para lo
  siguiente cuando corresponde
- **Fechas en formato chileno**: `05-12-2025`
- **Al marcar algo como resuelto**: se tacha, desaparece a los 3 segundos, con
  botón "Deshacer" durante ese intervalo

## Base de datos

Todas las tablas usan `id uuid primary key default gen_random_uuid()` y
`created_at timestamptz default now()`.

Tablas principales: `clientes`, `causas`, `audiencias`, `tareas`, `plazos`,
`documentos`, `siau`, `pjud`, `seguimiento`, `revisiones`, `revision_activa`,
`reuniones`, `reunion_temas`, `prospectos`, `prospecto_interacciones`,
`gastos`, `agenda_notas`, `agenda_pendientes`, `configuracion_sistema`,
`google_tokens`.

Notas:

- `causas.cliente_id` referencia a `clientes`. Siempre vincular por id, nunca
  por nombre.
- `revision_activa` es la tabla viva del módulo de revisión.
  `revision_periodos` quedó de una versión anterior y está vacía.
- Las causas de policía local usan ROL, no RIT, y no tienen RUC. La tabla ya
  distingue `rit`/`ruc` y `tribunal`/`fiscalia`.

### RLS

Todas las tablas tienen Row Level Security activada con una política única de
acceso total para `anon`. Al crear una tabla nueva hay que replicarla:

```sql
alter table <tabla> enable row level security;

create policy "Acceso total anon <tabla>"
on <tabla> for all using (true) with check (true);
```

## Cómo trabajar

**Claude Code no tiene acceso a Supabase.** Cuando un cambio requiera tocar la
base, entrega el SQL en un bloque aparte, al principio de la respuesta, con la
indicación de correrlo en el SQL Editor de Supabase antes de probar el código.
Nunca asumas que una tabla o columna existe: si hace falta, dilo.

Antes de construir algo nuevo, revisa si ya existe un módulo que hace algo
parecido. El sistema tiene varios lugares donde anotar cosas y el riesgo real es
la duplicación: que la misma información termine en dos módulos distintos según
dónde estaba parada la usuaria. Si detectas ese solapamiento, dilo antes de
construir.

## Contexto del dominio

Vocabulario del litigio chileno, para que los rótulos y campos tengan sentido:

- **RUC**: rol único de causa, del Ministerio Público. **RIT**: rol interno del
  tribunal. Una causa penal tiene ambos.
- **SIAU**: Sistema de Información y Atención a Usuarios del Ministerio
  Público. Es donde se solicitan copias de la carpeta investigativa y se hacen
  consultas a la fiscalía.
- **PJUD**: Poder Judicial. El módulo registra las gestiones y resoluciones del
  tribunal.
- **OI**: orden de investigar que el fiscal dirige a la policía. Contiene
  instrucciones particulares, que la policía responde con informes.
- **Carpeta investigativa**: el expediente de la fiscalía.
- **Calidad en que actúa**: querellante (por la víctima) o defensa (por el
  imputado). Cambia todo el enfoque de la causa.
- **Etapa procesal**: investigación desformalizada, formalizada, preparación de
  juicio oral, juicio oral.
