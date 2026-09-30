CREATE TABLE IF NOT EXISTS import_sources (
  id integer PRIMARY KEY,
  filename text NOT NULL,
  sha256 text NOT NULL,
  metadata jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS teams (
  id integer PRIMARY KEY,
  name text NOT NULL UNIQUE,
  color text NOT NULL
);
CREATE TABLE IF NOT EXISTS players (
  id integer PRIMARY KEY,
  team_id integer NOT NULL REFERENCES teams(id),
  name text NOT NULL,
  original_name text NOT NULL,
  placeholder boolean NOT NULL DEFAULT false,
  source_cell text NOT NULL
);
CREATE TABLE IF NOT EXISTS player_stats (
  player_id integer PRIMARY KEY REFERENCES players(id),
  stats jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS round_stats (
  player_id integer NOT NULL REFERENCES players(id),
  round integer NOT NULL CHECK (round BETWEEN 1 AND 30),
  stats jsonb NOT NULL,
  source_cell text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, round)
);
CREATE INDEX IF NOT EXISTS round_stats_round_idx ON round_stats(round);
CREATE INDEX IF NOT EXISTS players_team_idx ON players(team_id);
CREATE OR REPLACE FUNCTION notify_stats_changed() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('stats_changed', TG_TABLE_NAME);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION touch_stats_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS stats_timestamp ON player_stats;
CREATE TRIGGER stats_timestamp BEFORE UPDATE ON player_stats FOR EACH ROW EXECUTE FUNCTION touch_stats_updated_at();
DROP TRIGGER IF EXISTS round_timestamp ON round_stats;
CREATE TRIGGER round_timestamp BEFORE UPDATE ON round_stats FOR EACH ROW EXECUTE FUNCTION touch_stats_updated_at();
DROP TRIGGER IF EXISTS stats_notify ON player_stats;
CREATE TRIGGER stats_notify AFTER INSERT OR UPDATE OR DELETE ON player_stats FOR EACH STATEMENT EXECUTE FUNCTION notify_stats_changed();
DROP TRIGGER IF EXISTS round_notify ON round_stats;
CREATE TRIGGER round_notify AFTER INSERT OR UPDATE OR DELETE ON round_stats FOR EACH STATEMENT EXECUTE FUNCTION notify_stats_changed();
DROP TRIGGER IF EXISTS players_notify ON players;
CREATE TRIGGER players_notify AFTER INSERT OR UPDATE OR DELETE ON players FOR EACH STATEMENT EXECUTE FUNCTION notify_stats_changed();
DROP TRIGGER IF EXISTS teams_notify ON teams;
CREATE TRIGGER teams_notify AFTER INSERT OR UPDATE OR DELETE ON teams FOR EACH STATEMENT EXECUTE FUNCTION notify_stats_changed();
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE round_stats ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE players ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE players ADD COLUMN IF NOT EXISTS member boolean;
ALTER TABLE players ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
CREATE SEQUENCE IF NOT EXISTS roster_player_ids;
SELECT setval('roster_player_ids',GREATEST((SELECT COALESCE(max(id),1) FROM players),(SELECT last_value FROM roster_player_ids)),true);
ALTER TABLE players ALTER COLUMN id SET DEFAULT nextval('roster_player_ids');
CREATE TABLE IF NOT EXISTS schedule_imports (
  id integer PRIMARY KEY, filename text NOT NULL, sha256 text NOT NULL,
  metadata jsonb NOT NULL, imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS games (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  turn integer NOT NULL DEFAULT 1 CHECK (turn = 1),
  round integer NOT NULL CHECK (round BETWEEN 1 AND 16),
  date date NOT NULL, time time NOT NULL,
  home_team_id integer NOT NULL REFERENCES teams(id),
  away_team_id integer NOT NULL REFERENCES teams(id),
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','postponed','completed','cancelled')),
  source_cell text UNIQUE, deleted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
  CHECK (home_team_id <> away_team_id)
);
CREATE INDEX IF NOT EXISTS games_calendar_idx ON games(date,time);
ALTER TABLE games ADD COLUMN IF NOT EXISTS home_score integer CHECK (home_score BETWEEN 0 AND 9999);
ALTER TABLE games ADD COLUMN IF NOT EXISTS away_score integer CHECK (away_score BETWEEN 0 AND 9999);
CREATE TABLE IF NOT EXISTS audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity text NOT NULL, entity_id text NOT NULL, operation text NOT NULL,
  before_data jsonb, after_data jsonb, responsible text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS games_timestamp ON games;
CREATE TRIGGER games_timestamp BEFORE UPDATE ON games FOR EACH ROW EXECUTE FUNCTION touch_stats_updated_at();
DROP TRIGGER IF EXISTS games_notify ON games;
CREATE TRIGGER games_notify AFTER INSERT OR UPDATE OR DELETE ON games FOR EACH STATEMENT EXECUTE FUNCTION notify_stats_changed();
CREATE TABLE IF NOT EXISTS admin_users (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE, password_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash text PRIMARY KEY, user_id integer NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  csrf_token text NOT NULL, expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions(expires_at);
CREATE TABLE IF NOT EXISTS login_limits (
  key text PRIMARY KEY, attempts integer NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS import_batches (
  id uuid PRIMARY KEY, user_id integer NOT NULL REFERENCES admin_users(id),
  kind text NOT NULL CHECK(kind IN ('players','stats')), filename text NOT NULL,
  sha256 text NOT NULL, payload jsonb NOT NULL, row_count integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','applied')),
  result jsonb, created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '1 hour', applied_at timestamptz
);
CREATE TABLE IF NOT EXISTS league_settings (
  id integer PRIMARY KEY CHECK(id=1), name text NOT NULL,
  logo bytea, logo_type text, logo_version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO league_settings(id,name) VALUES(1,'Liga de Sóftbol Nocturna Varonil') ON CONFLICT(id) DO NOTHING;
ALTER TABLE league_settings ADD COLUMN IF NOT EXISTS standings_criteria jsonb NOT NULL DEFAULT '[]';
ALTER TABLE league_settings ADD COLUMN IF NOT EXISTS rules_confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE league_settings ADD COLUMN IF NOT EXISTS rules_notes text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS game_player_hits (
  game_id integer NOT NULL REFERENCES games(id), player_id integer NOT NULL REFERENCES players(id),
  team_id integer NOT NULL REFERENCES teams(id), hits integer NOT NULL CHECK(hits BETWEEN 0 AND 9999),
  version integer NOT NULL DEFAULT 1, deleted_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(game_id,player_id)
);
DROP TRIGGER IF EXISTS game_hits_notify ON game_player_hits;
CREATE TRIGGER game_hits_notify AFTER INSERT OR UPDATE OR DELETE ON game_player_hits FOR EACH STATEMENT EXECUTE FUNCTION notify_stats_changed();
DROP TRIGGER IF EXISTS league_notify ON league_settings;
CREATE TRIGGER league_notify AFTER UPDATE ON league_settings FOR EACH STATEMENT EXECUTE FUNCTION notify_stats_changed();
