-- ==========================================
-- 0028: ACEPTACIÓN DE TÉRMINOS Y PRIVACIDAD
-- ==========================================
--
-- /api/legal/accept guarda aquí quién aceptó qué
-- versión de los términos (cliente, empleado o
-- dueño). Idempotente: si la tabla ya se creó a
-- mano, solo agrega lo que falte.
-- ==========================================

create table if not exists legal_acceptances (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  document_type    text not null,
  document_version text not null,
  accepted_at      timestamptz not null default now()
);

alter table legal_acceptances add column if not exists accepted_at timestamptz not null default now();

-- La API hace upsert con onConflict "user_id,document_type,document_version".
create unique index if not exists legal_acceptances_user_doc_version
  on legal_acceptances (user_id, document_type, document_version);

-- Solo el servidor la usa.
alter table legal_acceptances enable row level security;
grant select, insert, update, delete on table legal_acceptances to service_role;

notify pgrst, 'reload schema';
