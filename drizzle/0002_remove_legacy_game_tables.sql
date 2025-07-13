-- Remove legacy game-related tables that were used for WebSocket-based real-time games

-- Drop indexes first
DROP INDEX IF EXISTS idx_game_sessions_join_code;
DROP INDEX IF EXISTS idx_game_sessions_status;
DROP INDEX IF EXISTS idx_game_players_session_id;
DROP INDEX IF EXISTS idx_game_players_socket_id;
DROP INDEX IF EXISTS idx_game_questions_session_id;
DROP INDEX IF EXISTS idx_player_answers_player_id;
DROP INDEX IF EXISTS idx_player_answers_question_id;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS player_answers;
DROP TABLE IF EXISTS game_questions;
DROP TABLE IF EXISTS game_players;
DROP TABLE IF EXISTS game_sessions;

-- Remove socket_id columns from any remaining tables
-- Note: These columns don't exist in the current schema, but added for completeness
-- in case they exist in production database