CREATE TABLE `game_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`phase` text NOT NULL,
	`state` text,
	`message_id` text,
	`winner_id` text,
	`forfeiter` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `move_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`player_id` text NOT NULL,
	`move_data` text NOT NULL,
	`move_number` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `player_stats` (
	`player_id` text NOT NULL,
	`game_id` text NOT NULL,
	`wins` integer DEFAULT 0 NOT NULL,
	`losses` integer DEFAULT 0 NOT NULL,
	`draws` integer DEFAULT 0 NOT NULL,
	`elo` integer DEFAULT 1000 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_stats_player_game` ON `player_stats` (`player_id`,`game_id`);--> statement-breakpoint
CREATE TABLE `players` (
	`discord_id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session_players` (
	`session_id` text NOT NULL,
	`player_id` text NOT NULL,
	`seat_index` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_players_session_seat` ON `session_players` (`session_id`,`seat_index`);