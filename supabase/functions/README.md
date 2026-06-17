# Edge Functions — Google Calendar

## Deploy

```bash
# Desde la raíz del proyecto
npx supabase login                  # autenticarse una vez
npx supabase functions deploy google-oauth-callback  --project-ref zzcdkjoetgclbtcuqswr
npx supabase functions deploy google-calendar-sync   --project-ref zzcdkjoetgclbtcuqswr
npx supabase functions deploy google-calendar-webhook --project-ref zzcdkjoetgclbtcuqswr
```

## Secrets requeridos en Supabase Dashboard → Settings → Edge Functions

Ya configurados (no incluir en código):
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` = `https://zzcdkjoetgclbtcuqswr.supabase.co/functions/v1/google-oauth-callback`
- `APP_URL` = `https://sistema-bl-git-main-mtaverne-4721s-projects.vercel.app`

## Migración SQL

Ejecutar en Supabase → SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS google_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token  text        NOT NULL,
  refresh_token text,
  expires_at    timestamptz,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE audiencias ADD COLUMN IF NOT EXISTS google_event_id text;
```

## Flujo OAuth

1. Usuario hace click "Conectar" → redirige a Google con `client_id` y `redirect_uri` apuntando a la Edge Function
2. Google redirige a `google-oauth-callback` con el código
3. La función intercambia el código por tokens (usando `GOOGLE_CLIENT_SECRET` server-side)
4. Guarda tokens en tabla `google_tokens` (fila única con id fijo)
5. Redirige a `/configuracion?calendar=connected`
6. La app detecta conexión leyendo la tabla `google_tokens`
