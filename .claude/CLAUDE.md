# Glaude — Agent Context

Discord multiplayer games bot for couples/groups. Adding a game = implement one interface + one registry line.

## Context Files
- `docs/backend.md` — bot server architecture, SessionManager, WS protocol, DB schema, packages
- `docs/frontend.md` — React activity app, game context, board interaction, component tree
- `docs/discord.md` — bot vs activity, auth flow, slash commands, env vars, session ID conventions
- `docs/ABALONE.md` — Abalone rules, board representation, move types, rendering spec
- `docs/KeyFiles.md` - Key files for frontend and backend
- `docs/stubs.d.ts` - contains code stubs for the entire project
- `docs/COUP.md` - COUP rules, summary and instructions for development.
- `docs/coup_plan/` - Phase-wise plan of development

## Conventions
- TS strict: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`
- Files: kebab-case | Types: PascalCase | Functions: camelCase | Constants: SCREAMING_SNAKE_CASE
- Packages: `@glaude/` scope | DB columns: snake_case
- Game logic: `Result<T,E>` (no throws) | Infra errors: thrown `GlaudeError`
- Biome: 2-space, double quotes, semicolons, trailing commas

## Strict Guidelines
- Don't read all files just to get context. Infer context based on the docs and stubs as much as possible.
- You don't need to read the entire code just to get context.

## Workflow
- Plan before executing non-trivial tasks
- Keep all durable context in markdown files, not chat
- After every few commands `/compact`

## Status
**Coup & Abalone**: Both games fully multiplayer-functional. Discord Activities properly integrated with OAuth2 token exchange.

**Key Fixes Applied:**
- Coup game now properly tracks `moveNumber` in game state (was missing, causing DB constraint errors)
- Discord SDK initialization errors now visible on-screen instead of silent black screen
- Server restart process documented with Cloudflared tunnel URL update instructions
- Log files auto-clear on each startup for cleaner debugging

## Server Management
- Start all services: `./start-services.sh`
- Kill services: `pkill -f "tsx.*src/index.ts"; pkill -f "vite"; pkill -f "cloudflared"`
- After Cloudflared restart: Update Discord Developer Portal (Activities → URL Mappings with new tunnel URL)
- Monitor logs: `tail -f logs/coup-bot.log` (logs auto-cleared on startup)
- Reset database: `rm apps/coup-bot/glaude.db` (WARNING: deletes game sessions)
