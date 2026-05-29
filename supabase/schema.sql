-- =========================================================
-- PokeDuel Arena - RESET + SCHEMA COMPLETO
-- Angular + Supabase + PokeAPI + Partidas Online
-- =========================================================

-- =========================================================
-- 0. LIMPIEZA SEGURA DE TABLAS DEL PROYECTO
-- Esto NO borra usuarios de auth.users.
-- Sí borra perfiles públicos, mazos, cartas, salas, partidas y estadísticas.
-- =========================================================

drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.match_actions cascade;
drop table if exists public.match_results cascade;
drop table if exists public.online_game_states cascade;
drop table if exists public.online_rooms cascade;
drop table if exists public.matches cascade;
drop table if exists public.deck_cards cascade;
drop table if exists public.decks cascade;
drop table if exists public.cards cascade;
drop table if exists public.user_stats cascade;
drop table if exists public.profiles cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.update_user_stats_after_result() cascade;

-- =========================================================
-- 1. EXTENSIONES
-- =========================================================

create extension if not exists "pgcrypto";

-- =========================================================
-- 2. TABLA: PROFILES
-- Perfil público del usuario autenticado
-- =========================================================

create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    username text not null,
    email text not null,
    avatar_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- =========================================================
-- 3. TABLA: CARDS
-- Cartas Pokémon generadas desde PokeAPI
-- =========================================================

create table public.cards (
    id bigint primary key,
    pokemon_id int not null unique,
    name text not null,
    image_url text,
    types text[] not null default '{}',
    attack int not null default 0,
    defense int not null default 0,
    hp int not null default 0,
    max_hp int not null default 0,
    ability_name text,
    ability_description text,
    ability_type text,
    rarity text not null default 'Común',
    level int not null default 1,
    energy_cost int not null default 1,
    description text,
    raw_data jsonb,
    created_at timestamptz not null default now(),

    constraint cards_rarity_check check (
        rarity in ('Común', 'Rara', 'Épica', 'Legendaria')
    ),

    constraint cards_stats_check check (
        attack >= 0 and
        defense >= 0 and
        hp >= 0 and
        max_hp >= 0 and
        level >= 1 and
        energy_cost >= 1
    )
);

-- =========================================================
-- 4. TABLA: DECKS
-- Mazos creados por cada usuario
-- =========================================================

create table public.decks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    name text not null,
    is_active boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- =========================================================
-- 5. TABLA: DECK_CARDS
-- Relación entre mazos y cartas
-- IMPORTANTE: usar card_id, NO pokemon_id.
-- =========================================================

create table public.deck_cards (
    id uuid primary key default gen_random_uuid(),
    deck_id uuid not null references public.decks(id) on delete cascade,
    card_id bigint not null references public.cards(id) on delete cascade,
    quantity int not null default 1,

    constraint deck_cards_quantity_check check (
        quantity >= 1 and quantity <= 4
    ),

    unique(deck_id, card_id)
);

-- =========================================================
-- 6. TABLA: MATCHES
-- Partidas generales, tanto solo como online
-- =========================================================

create table public.matches (
    id uuid primary key default gen_random_uuid(),
    mode text not null,
    player1_id uuid references public.profiles(id) on delete set null,
    player2_id uuid references public.profiles(id) on delete set null,
    winner_id uuid references public.profiles(id) on delete set null,
    status text not null default 'ACTIVE',
    started_at timestamptz not null default now(),
    ended_at timestamptz,

    constraint matches_mode_check check (
        mode in ('SOLO', 'ONLINE')
    ),

    constraint matches_status_check check (
        status in ('WAITING', 'ACTIVE', 'FINISHED', 'ABANDONED')
    )
);

-- =========================================================
-- 7. TABLA: ONLINE_ROOMS
-- Salas para partidas jugador contra jugador
-- =========================================================

create table public.online_rooms (
    id uuid primary key default gen_random_uuid(),
    room_code text not null unique,
    player1_id uuid not null references public.profiles(id) on delete cascade,
    player2_id uuid references public.profiles(id) on delete cascade,
    status text not null default 'WAITING',
    current_turn uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint online_rooms_status_check check (
        status in ('WAITING', 'ACTIVE', 'FINISHED', 'ABANDONED')
    )
);

-- =========================================================
-- 8. TABLA: ONLINE_GAME_STATES
-- Estado serializado de la partida online
-- room_id debe ser UNIQUE para usar upsert onConflict: 'room_id'
-- =========================================================

create table public.online_game_states (
    id uuid primary key default gen_random_uuid(),
    room_id uuid not null references public.online_rooms(id) on delete cascade,
    state jsonb not null,
    version int not null default 1,
    updated_at timestamptz not null default now(),

    unique(room_id)
);

-- =========================================================
-- 9. TABLA: MATCH_ACTIONS
-- Historial de acciones realizadas durante partidas
-- =========================================================

create table public.match_actions (
    id uuid primary key default gen_random_uuid(),
    match_id uuid references public.matches(id) on delete cascade,
    room_id uuid references public.online_rooms(id) on delete cascade,
    player_id uuid references public.profiles(id) on delete set null,
    action_type text not null,
    action_payload jsonb,
    message text,
    created_at timestamptz not null default now()
);

-- =========================================================
-- 10. TABLA: MATCH_RESULTS
-- Resultados finales de partidas
-- =========================================================

create table public.match_results (
    id uuid primary key default gen_random_uuid(),
    match_id uuid references public.matches(id) on delete cascade,
    winner_id uuid references public.profiles(id) on delete set null,
    loser_id uuid references public.profiles(id) on delete set null,
    mode text not null,
    result_reason text,
    turns_played int not null default 0,
    total_damage_player1 int not null default 0,
    total_damage_player2 int not null default 0,
    cards_used_player1 int not null default 0,
    cards_used_player2 int not null default 0,
    created_at timestamptz not null default now(),

    constraint match_results_mode_check check (
        mode in ('SOLO', 'ONLINE')
    )
);

-- =========================================================
-- 11. TABLA: USER_STATS
-- Estadísticas generales del usuario
-- =========================================================

create table public.user_stats (
    user_id uuid primary key references public.profiles(id) on delete cascade,
    wins int not null default 0,
    losses int not null default 0,
    total_matches int not null default 0,
    solo_wins int not null default 0,
    solo_losses int not null default 0,
    online_wins int not null default 0,
    online_losses int not null default 0,
    updated_at timestamptz not null default now()
);

-- =========================================================
-- 12. ÍNDICES
-- =========================================================

create index idx_cards_name on public.cards(name);
create index idx_cards_pokemon_id on public.cards(pokemon_id);
create index idx_cards_rarity on public.cards(rarity);

create index idx_decks_user_id on public.decks(user_id);
create index idx_deck_cards_deck_id on public.deck_cards(deck_id);
create index idx_deck_cards_card_id on public.deck_cards(card_id);

create index idx_matches_player1_id on public.matches(player1_id);
create index idx_matches_player2_id on public.matches(player2_id);
create index idx_matches_winner_id on public.matches(winner_id);

create index idx_online_rooms_room_code on public.online_rooms(room_code);
create index idx_online_rooms_player1_id on public.online_rooms(player1_id);
create index idx_online_rooms_player2_id on public.online_rooms(player2_id);
create index idx_online_game_states_room_id on public.online_game_states(room_id);

create index idx_match_actions_match_id on public.match_actions(match_id);
create index idx_match_actions_room_id on public.match_actions(room_id);
create index idx_match_actions_player_id on public.match_actions(player_id);

create index idx_match_results_winner_id on public.match_results(winner_id);
create index idx_match_results_loser_id on public.match_results(loser_id);

-- =========================================================
-- 13. FUNCIONES AUXILIARES
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (
        id,
        username,
        email,
        avatar_url
    )
    values (
        new.id,
        coalesce(
            new.raw_user_meta_data ->> 'username',
            split_part(coalesce(new.email, ''), '@', 1),
            'usuario'
        ),
        coalesce(new.email, ''),
        new.raw_user_meta_data ->> 'avatar_url'
    )
    on conflict (id) do nothing;

    insert into public.user_stats (
        user_id,
        wins,
        losses,
        total_matches,
        solo_wins,
        solo_losses,
        online_wins,
        online_losses
    )
    values (
        new.id,
        0,
        0,
        0,
        0,
        0,
        0,
        0
    )
    on conflict (user_id) do nothing;

    return new;
end;
$$;

create or replace function public.update_user_stats_after_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.winner_id is not null then
        insert into public.user_stats (
            user_id,
            wins,
            losses,
            total_matches,
            solo_wins,
            solo_losses,
            online_wins,
            online_losses,
            updated_at
        )
        values (
            new.winner_id,
            1,
            0,
            1,
            case when new.mode = 'SOLO' then 1 else 0 end,
            0,
            case when new.mode = 'ONLINE' then 1 else 0 end,
            0,
            now()
        )
        on conflict (user_id)
        do update set
            wins = public.user_stats.wins + 1,
            total_matches = public.user_stats.total_matches + 1,
            solo_wins = public.user_stats.solo_wins + case when new.mode = 'SOLO' then 1 else 0 end,
            online_wins = public.user_stats.online_wins + case when new.mode = 'ONLINE' then 1 else 0 end,
            updated_at = now();
    end if;

    if new.loser_id is not null then
        insert into public.user_stats (
            user_id,
            wins,
            losses,
            total_matches,
            solo_wins,
            solo_losses,
            online_wins,
            online_losses,
            updated_at
        )
        values (
            new.loser_id,
            0,
            1,
            1,
            0,
            case when new.mode = 'SOLO' then 1 else 0 end,
            0,
            case when new.mode = 'ONLINE' then 1 else 0 end,
            now()
        )
        on conflict (user_id)
        do update set
            losses = public.user_stats.losses + 1,
            total_matches = public.user_stats.total_matches + 1,
            solo_losses = public.user_stats.solo_losses + case when new.mode = 'SOLO' then 1 else 0 end,
            online_losses = public.user_stats.online_losses + case when new.mode = 'ONLINE' then 1 else 0 end,
            updated_at = now();
    end if;

    return new;
end;
$$;

-- =========================================================
-- 14. TRIGGERS
-- =========================================================

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger set_decks_updated_at
before update on public.decks
for each row
execute function public.set_updated_at();

create trigger set_online_rooms_updated_at
before update on public.online_rooms
for each row
execute function public.set_updated_at();

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create trigger update_stats_after_match_result
after insert on public.match_results
for each row
execute function public.update_user_stats_after_result();

-- =========================================================
-- 15. BACKFILL DE USUARIOS EXISTENTES
-- Importante porque los usuarios de auth.users NO se borraron con DROP TABLE.
-- Esto recrea profiles y user_stats para usuarios ya existentes.
-- =========================================================

insert into public.profiles (
    id,
    username,
    email,
    avatar_url
)
select
    users.id,
    coalesce(
        users.raw_user_meta_data ->> 'username',
        split_part(coalesce(users.email, ''), '@', 1),
        'usuario'
    ) as username,
    coalesce(users.email, '') as email,
    users.raw_user_meta_data ->> 'avatar_url' as avatar_url
from auth.users as users
on conflict (id)
do update set
    email = excluded.email,
    username = coalesce(public.profiles.username, excluded.username),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = now();

insert into public.user_stats (
    user_id,
    wins,
    losses,
    total_matches,
    solo_wins,
    solo_losses,
    online_wins,
    online_losses
)
select
    users.id,
    0,
    0,
    0,
    0,
    0,
    0,
    0
from auth.users as users
on conflict (user_id) do nothing;

-- =========================================================
-- 16. ACTIVAR ROW LEVEL SECURITY
-- =========================================================

alter table public.profiles enable row level security;
alter table public.cards enable row level security;
alter table public.decks enable row level security;
alter table public.deck_cards enable row level security;
alter table public.matches enable row level security;
alter table public.online_rooms enable row level security;
alter table public.online_game_states enable row level security;
alter table public.match_actions enable row level security;
alter table public.match_results enable row level security;
alter table public.user_stats enable row level security;

-- =========================================================
-- 17. POLÍTICAS RLS: PROFILES
-- =========================================================

create policy "profiles_select_policy"
on public.profiles
for select
to authenticated
using (true);

create policy "profiles_insert_policy"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "profiles_update_policy"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- =========================================================
-- 18. POLÍTICAS RLS: CARDS
-- =========================================================

create policy "cards_select_policy"
on public.cards
for select
to authenticated
using (true);

create policy "cards_insert_policy"
on public.cards
for insert
to authenticated
with check (true);

create policy "cards_update_policy"
on public.cards
for update
to authenticated
using (true)
with check (true);

-- =========================================================
-- 19. POLÍTICAS RLS: DECKS
-- =========================================================

create policy "decks_select_policy"
on public.decks
for select
to authenticated
using (auth.uid() = user_id);

create policy "decks_insert_policy"
on public.decks
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "decks_update_policy"
on public.decks
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "decks_delete_policy"
on public.decks
for delete
to authenticated
using (auth.uid() = user_id);

-- =========================================================
-- 20. POLÍTICAS RLS: DECK_CARDS
-- =========================================================

create policy "deck_cards_select_policy"
on public.deck_cards
for select
to authenticated
using (
    exists (
        select 1
        from public.decks
        where public.decks.id = public.deck_cards.deck_id
        and public.decks.user_id = auth.uid()
    )
);

create policy "deck_cards_insert_policy"
on public.deck_cards
for insert
to authenticated
with check (
    exists (
        select 1
        from public.decks
        where public.decks.id = public.deck_cards.deck_id
        and public.decks.user_id = auth.uid()
    )
);

create policy "deck_cards_update_policy"
on public.deck_cards
for update
to authenticated
using (
    exists (
        select 1
        from public.decks
        where public.decks.id = public.deck_cards.deck_id
        and public.decks.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.decks
        where public.decks.id = public.deck_cards.deck_id
        and public.decks.user_id = auth.uid()
    )
);

create policy "deck_cards_delete_policy"
on public.deck_cards
for delete
to authenticated
using (
    exists (
        select 1
        from public.decks
        where public.decks.id = public.deck_cards.deck_id
        and public.decks.user_id = auth.uid()
    )
);

-- =========================================================
-- 21. POLÍTICAS RLS: MATCHES
-- =========================================================

create policy "matches_select_policy"
on public.matches
for select
to authenticated
using (
    auth.uid() = player1_id
    or auth.uid() = player2_id
    or auth.uid() = winner_id
);

create policy "matches_insert_policy"
on public.matches
for insert
to authenticated
with check (
    auth.uid() = player1_id
    or auth.uid() = player2_id
);

create policy "matches_update_policy"
on public.matches
for update
to authenticated
using (
    auth.uid() = player1_id
    or auth.uid() = player2_id
)
with check (
    auth.uid() = player1_id
    or auth.uid() = player2_id
);

-- =========================================================
-- 22. POLÍTICAS RLS: ONLINE_ROOMS
-- =========================================================

create policy "online_rooms_select_policy"
on public.online_rooms
for select
to authenticated
using (
    auth.uid() = player1_id
    or auth.uid() = player2_id
    or status = 'WAITING'
);

create policy "online_rooms_insert_policy"
on public.online_rooms
for insert
to authenticated
with check (
    auth.uid() = player1_id
);

create policy "online_rooms_update_policy"
on public.online_rooms
for update
to authenticated
using (
    auth.uid() = player1_id
    or auth.uid() = player2_id
    or (
        player2_id is null
        and status = 'WAITING'
    )
)
with check (
    auth.uid() = player1_id
    or auth.uid() = player2_id
);

-- =========================================================
-- 23. POLÍTICAS RLS: ONLINE_GAME_STATES
-- =========================================================

create policy "online_game_states_select_policy"
on public.online_game_states
for select
to authenticated
using (
    exists (
        select 1
        from public.online_rooms
        where public.online_rooms.id = public.online_game_states.room_id
        and (
            public.online_rooms.player1_id = auth.uid()
            or public.online_rooms.player2_id = auth.uid()
        )
    )
);

create policy "online_game_states_insert_policy"
on public.online_game_states
for insert
to authenticated
with check (
    exists (
        select 1
        from public.online_rooms
        where public.online_rooms.id = public.online_game_states.room_id
        and (
            public.online_rooms.player1_id = auth.uid()
            or public.online_rooms.player2_id = auth.uid()
        )
    )
);

create policy "online_game_states_update_policy"
on public.online_game_states
for update
to authenticated
using (
    exists (
        select 1
        from public.online_rooms
        where public.online_rooms.id = public.online_game_states.room_id
        and (
            public.online_rooms.player1_id = auth.uid()
            or public.online_rooms.player2_id = auth.uid()
        )
    )
)
with check (
    exists (
        select 1
        from public.online_rooms
        where public.online_rooms.id = public.online_game_states.room_id
        and (
            public.online_rooms.player1_id = auth.uid()
            or public.online_rooms.player2_id = auth.uid()
        )
    )
);

-- =========================================================
-- 24. POLÍTICAS RLS: MATCH_ACTIONS
-- =========================================================

create policy "match_actions_select_policy"
on public.match_actions
for select
to authenticated
using (
    player_id = auth.uid()
    or exists (
        select 1
        from public.online_rooms
        where public.online_rooms.id = public.match_actions.room_id
        and (
            public.online_rooms.player1_id = auth.uid()
            or public.online_rooms.player2_id = auth.uid()
        )
    )
    or exists (
        select 1
        from public.matches
        where public.matches.id = public.match_actions.match_id
        and (
            public.matches.player1_id = auth.uid()
            or public.matches.player2_id = auth.uid()
        )
    )
);

create policy "match_actions_insert_policy"
on public.match_actions
for insert
to authenticated
with check (
    player_id = auth.uid()
);

-- =========================================================
-- 25. POLÍTICAS RLS: MATCH_RESULTS
-- =========================================================

create policy "match_results_select_policy"
on public.match_results
for select
to authenticated
using (
    auth.uid() = winner_id
    or auth.uid() = loser_id
    or exists (
        select 1
        from public.matches
        where public.matches.id = public.match_results.match_id
        and (
            public.matches.player1_id = auth.uid()
            or public.matches.player2_id = auth.uid()
        )
    )
);

create policy "match_results_insert_policy"
on public.match_results
for insert
to authenticated
with check (
    auth.uid() = winner_id
    or auth.uid() = loser_id
);

-- =========================================================
-- 26. POLÍTICAS RLS: USER_STATS
-- =========================================================

create policy "user_stats_select_policy"
on public.user_stats
for select
to authenticated
using (true);

create policy "user_stats_insert_policy"
on public.user_stats
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "user_stats_update_policy"
on public.user_stats
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- =========================================================
-- 27. REALTIME SEGURO
-- Agrega tablas a supabase_realtime solo si aún no están agregadas.
-- =========================================================
-- =========================================================
-- PokeDuel Arena - FIX DE PERMISOS SUPABASE
-- Ejecutar después de crear el schema completo.
-- No borra datos.
-- =========================================================

grant usage on schema public to anon, authenticated;

-- PROFILES
grant select, insert, update on table public.profiles to authenticated;

-- CARDS
grant select, insert, update on table public.cards to authenticated;

-- DECKS
grant select, insert, update, delete on table public.decks to authenticated;

-- DECK_CARDS
grant select, insert, update, delete on table public.deck_cards to authenticated;

-- MATCHES
grant select, insert, update on table public.matches to authenticated;

-- ONLINE_ROOMS
grant select, insert, update on table public.online_rooms to authenticated;

-- ONLINE_GAME_STATES
grant select, insert, update, delete on table public.online_game_states to authenticated;

-- MATCH_ACTIONS
grant select, insert on table public.match_actions to authenticated;

-- MATCH_RESULTS
grant select, insert on table public.match_results to authenticated;

-- USER_STATS
grant select, insert, update on table public.user_stats to authenticated;

-- Permisos para futuras tablas que crees después
alter default privileges in schema public
grant select, insert, update, delete on tables to authenticated;

do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'online_rooms'
    ) then
        alter publication supabase_realtime add table public.online_rooms;
    end if;

    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'online_game_states'
    ) then
        alter publication supabase_realtime add table public.online_game_states;
    end if;

    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'match_actions'
    ) then
        alter publication supabase_realtime add table public.match_actions;
    end if;
end $$;

-- =========================================================
-- FIN DEL SCHEMA COMPLETO
-- =========================================================
