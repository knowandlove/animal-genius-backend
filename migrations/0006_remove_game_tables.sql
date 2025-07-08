-- Remove game-related tables as game features have been moved to a different server

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS player_answers;
DROP TABLE IF EXISTS game_questions;
DROP TABLE IF EXISTS game_players;
DROP TABLE IF EXISTS game_sessions;

-- Drop any indexes that might have been created for these tables
DROP INDEX IF EXISTS idx_game_sessions_code;
DROP INDEX IF EXISTS idx_game_sessions_teacher_id;
DROP INDEX IF EXISTS idx_game_sessions_status;
DROP INDEX IF EXISTS idx_game_players_game_id;
DROP INDEX IF EXISTS idx_game_players_player_id;
DROP INDEX IF EXISTS idx_game_questions_game_id;
DROP INDEX IF EXISTS idx_player_answers_game_id;
DROP INDEX IF EXISTS idx_player_answers_player_id;