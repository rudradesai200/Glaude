# Glaude - Task Tracker

### Phase 1: Scaffold
- [x] Initialize pnpm workspace with Turborepo
- [x] Create tsconfig.base.json (strict mode)
- [x] Configure Biome (root biome.json)
- [x] Create all package directories with package.json files
- [x] Set up Vitest config
- [x] Create .env.example + .gitignore
- [x] Run `pnpm install` to validate workspace

### Phase 2: @glaude/shared + @glaude/engine interfaces
- [x] Result<T,E> type + helpers (ok, err, isOk, isErr)
- [x] GlaudeError class
- [x] Branded types (PlayerId, SessionId, GameId)
- [x] GameDefinition<TState, TMove, TRenderContext> interface
- [x] GameOutcome, GamePhase, PlayerSeat types

### Phase 3: Abalone game logic
- [ ] AxialCoord + HEX_DIRECTIONS constants
- [ ] Board initializer (standard layout, 14 marbles each)
- [ ] Move types: inline, broadside, sumito
- [ ] Move validator (all rules from ABALONE.md)
- [ ] Move applier (returns new AbaloneState)
- [ ] Legal move generator
- [ ] Win condition checker (≤8 marbles = loss)
- [ ] GameDefinition implementation for Abalone
- [ ] Unit tests for all move rules

### Phase 4: Canvas rendering
- [ ] Hex grid painter (axial → pixel)
- [ ] Marble fill colours + border highlights
- [ ] Axial coordinate labels
- [ ] PNG output buffer

### Phase 5: Bot — commands, lobby, session, interactions
- [ ] Discord client setup (discord.js v14)
- [ ] Slash command registration (deploy-commands script)
- [ ] /game start <game> — create lobby
- [ ] /game join — join active lobby in channel
- [ ] /game forfeit
- [ ] /game status
- [ ] Lobby → Playing transition
- [ ] Session manager (in-memory, single game per channel)
- [ ] Interaction handler routing
- [ ] Single updatable message per session

### Phase 6: Drizzle schema + migrations + session recovery
- [ ] Define all tables (players, game_sessions, session_players, move_history, player_stats)
- [ ] Drizzle migrate setup
- [ ] Persist moves + sessions
- [ ] Recovery on bot restart

### Phase 7: Polish
- [ ] /stats [user]
- [ ] /help [game]
- [ ] Timeouts → CANCELLED
- [ ] Error boundary at interaction handler
- [ ] GlaudeError messages to Discord ephemeral replies
