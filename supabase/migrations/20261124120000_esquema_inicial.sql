-- Esquema inicial de YaComí.
-- Cada fila pertenece a un usuario (user_id) y RLS solo deja ver y tocar las propias.

create extension if not exists "pgcrypto";

-- Función común para mantener updated_at
create or replace function public.tocar_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Categorías de comida (las mismas que la app de iOS)
create type public.categoria_comida as enum
  ('Desayuno', 'Almuerzo', 'Comida', 'Merienda', 'Cena', 'Extra');

-- Despensa: alimentos guardados, valores por 100 g
create table public.foods (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  name          text not null check (length(trim(name)) > 0),
  kcal_100g     numeric(7,2) not null check (kcal_100g >= 0),
  protein_100g  numeric(6,2) not null default 0 check (protein_100g >= 0),
  carbs_100g    numeric(6,2) check (carbs_100g >= 0),
  fat_100g      numeric(6,2) check (fat_100g >= 0),
  barcode       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index foods_user_name on public.foods (user_id, lower(name));
create unique index foods_user_barcode on public.foods (user_id, barcode) where barcode is not null;

-- Platos y recetas: un plato es una lista de alimentos con sus gramos
create table public.dishes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.dish_items (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users on delete cascade,
  dish_id   uuid not null references public.dishes on delete cascade,
  food_id   uuid not null references public.foods on delete restrict,
  grams     numeric(7,1) not null check (grams > 0),
  position  smallint not null default 0
);
create index dish_items_dish on public.dish_items (dish_id);

-- Diario: cada comida apuntada. Guarda una copia de los valores por 100 g
-- para que el historial no cambie si luego se edita el alimento (salvo que
-- se pida corregir las comidas anteriores).
create table public.meals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  eaten_at      timestamptz not null default now(),
  eaten_on      date not null default (now() at time zone 'Europe/Helsinki')::date,
  category      public.categoria_comida not null,
  name          text not null,
  grams         numeric(7,1),
  kcal          integer not null check (kcal >= 0),
  protein       numeric(6,2) not null default 0,
  carbs         numeric(6,2),
  fat           numeric(6,2),
  kcal_100g     numeric(7,2),
  protein_100g  numeric(6,2),
  carbs_100g    numeric(6,2),
  fat_100g      numeric(6,2),
  food_id       uuid references public.foods on delete set null,
  dish_id       uuid references public.dishes on delete set null,
  source        text not null default 'manual'
                check (source in ('manual', 'despensa', 'plato', 'ia', 'escaner', 'repetir', 'importado')),
  created_at    timestamptz not null default now()
);
create index meals_user_day on public.meals (user_id, eaten_on desc);
create index meals_food on public.meals (food_id);

-- Peso: uno por día
create table public.weights (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  measured_on  date not null,
  weight_kg    numeric(5,2) not null check (weight_kg > 0),
  created_at   timestamptz not null default now(),
  unique (user_id, measured_on)
);

-- Medidas corporales: una por día
create table public.measurements (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  measured_on  date not null,
  waist_cm     numeric(5,1),
  chest_cm     numeric(5,1),
  thigh_cm     numeric(5,1),
  hip_cm       numeric(5,1),
  created_at   timestamptz not null default now(),
  unique (user_id, measured_on)
);

-- Objetivos y perfil: una fila por usuario
create table public.goals (
  user_id            uuid primary key default auth.uid() references auth.users on delete cascade,
  kcal_min           integer not null default 2200,
  kcal_max           integer not null default 2700,
  protein_g          numeric(5,1) not null default 165,
  carbs_g            numeric(5,1),
  fat_g              numeric(5,1),
  maintenance_kcal   integer,
  target_weight_kg   numeric(5,2),
  updated_at         timestamptz not null default now(),
  check (kcal_max >= kcal_min)
);

create trigger foods_updated  before update on public.foods  for each row execute function public.tocar_updated_at();
create trigger dishes_updated before update on public.dishes for each row execute function public.tocar_updated_at();
create trigger goals_updated  before update on public.goals  for each row execute function public.tocar_updated_at();

-- RLS: cada usuario solo ve y modifica lo suyo
do $$
declare t text;
begin
  foreach t in array array['foods','dishes','dish_items','meals','weights','measurements','goals'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "solo lo propio" on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Corregir comidas anteriores al editar un alimento de la despensa:
-- recalcula kcal y macros de todas las comidas enlazadas a ese alimento.
create or replace function public.corregir_comidas_de_alimento(p_food uuid)
returns integer language sql security invoker as $$
  with f as (select * from public.foods where id = p_food and user_id = auth.uid()),
  u as (
  update public.meals m set
    kcal_100g    = f.kcal_100g,
    protein_100g = f.protein_100g,
    carbs_100g   = f.carbs_100g,
    fat_100g     = f.fat_100g,
    kcal         = round(f.kcal_100g * m.grams / 100),
    protein      = round(f.protein_100g * m.grams / 100, 2),
    carbs        = round(f.carbs_100g * m.grams / 100, 2),
    fat          = round(f.fat_100g * m.grams / 100, 2)
  from f
  where m.food_id = f.id and m.user_id = auth.uid() and m.grams is not null
  returning 1
  )
  select count(*)::integer from u
$$;
