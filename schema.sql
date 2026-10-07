-- =====================================================
-- E-Classes / GamerClass - Schema para Supabase (PostgreSQL)
-- Rode no Supabase: SQL Editor > New query > Run
-- =====================================================

-- Limpa (útil para rodar de novo durante o desenvolvimento)
drop table if exists matches;
drop table if exists competitors;
drop table if exists teams;
drop table if exists games;

-- JOGOS
create table games (
    id         bigint generated always as identity primary key,
    name       text not null check (char_length(trim(name)) > 0),
    genre      text not null check (char_length(trim(genre)) > 0),
    created_at timestamptz not null default now()
);

-- TIMES
create table teams (
    id         bigint generated always as identity primary key,
    name       text not null unique check (char_length(trim(name)) > 0),
    color      text not null default '#6366f1' check (color ~* '^#[0-9a-f]{6}$'),
    created_at timestamptz not null default now()
);

-- COMPETIDORES (se o time for apagado, o competidor fica "Sem Time")
create table competitors (
    id         bigint generated always as identity primary key,
    name       text not null check (char_length(trim(name)) > 0),
    nickname   text not null check (char_length(trim(nickname)) > 0),
    team_id    bigint references teams(id) on delete set null,
    created_at timestamptz not null default now()
);

-- CONFRONTOS (se o jogo ou time for apagado, os confrontos dele são apagados)
create table matches (
    id         bigint generated always as identity primary key,
    game_id    bigint not null references games(id) on delete cascade,
    team1_id   bigint not null references teams(id) on delete cascade,
    team2_id   bigint not null references teams(id) on delete cascade,
    score1     integer not null default 0 check (score1 >= 0),
    score2     integer not null default 0 check (score2 >= 0),
    status     text not null default 'scheduled' check (status in ('scheduled', 'finished')),
    date       timestamp not null,
    created_at timestamptz not null default now(),
    constraint times_diferentes check (team1_id <> team2_id)
);

create index idx_competitors_team on competitors(team_id);
create index idx_matches_game     on matches(game_id);
create index idx_matches_team1    on matches(team1_id);
create index idx_matches_team2    on matches(team2_id);

-- Segurança: RLS ligado e sem policies = só a API (service role / secret key) acessa.
alter table games       enable row level security;
alter table teams       enable row level security;
alter table competitors enable row level security;
alter table matches     enable row level security;

-- DADOS INICIAIS (mesmos do data.json original)
insert into games (name, genre) values
    ('League of Legends', 'MOBA'),
    ('VALORANT', 'FPS'),
    ('Counter-Strike 2', 'FPS'),
    ('Rocket League', 'Esport');

insert into teams (name, color) values
    ('Cyber Dragons', '#7B1FA2'),
    ('Neon Knights', '#00BCD4');

insert into competitors (name, nickname, team_id) values
    ('Pedro Santos', 'Pterodactyl', 1),
    ('Julia Lima', 'JuliaX', 1),
    ('Carlos Eduardo', 'Cadu00', 2),
    ('Ana Oliveira', 'AnaPvP', 2);

insert into matches (game_id, team1_id, team2_id, score1, score2, status, date) values
    (1, 1, 2, 1, 0, 'finished',  '2026-03-24 14:00'),
    (2, 2, 1, 0, 0, 'scheduled', '2026-03-25 16:00');
