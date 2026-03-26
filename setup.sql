-- COPIA Y PEGA TODO ESTE CÓDIGO EN EL "SQL EDITOR" DE SUPABASE Y DALE AL BOTÓN "RUN"

-- 1. Crear la tabla para guardar los reportes de pagos
create table public.payments (
  id uuid default gen_random_uuid() primary key,
  payer_name text not null,
  reference text,
  payment_method text not null,
  receipt_url text not null,
  status text default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Desactivar temporalmente la seguridad de nivel de fila (RLS) para permitir que tu página HTML pública (sin login) envíe y lea los pagos sin errores.
alter table public.payments disable row level security;

-- 3. Crear el "Bucket" (caja fuerte) para almacenar las imágenes (comprobantes)
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', true);

-- 4. Permitir a los clientes (usuarios anónimos sin cuenta) subir imágenes a Storage y leerlas.
create policy "Public Access to Receipts Uploads" on storage.objects for insert to public with check ( bucket_id = 'receipts' );
create policy "Public Access to Receipts Reads" on storage.objects for select to public using ( bucket_id = 'receipts' );
create policy "Public Access to Receipts Updates" on storage.objects for update to public using ( bucket_id = 'receipts' );
