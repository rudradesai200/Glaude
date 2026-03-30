# Coup

## Objective
Design a multiplayer implementation of Coup as a Discord Activity. This should extend the current setup and not reinvent the wheel.

## Game Summary
- Each player starts with:
  - 2 hidden influence cards
  - 2 coins  
- Goal: Last player with influence remaining

### Actions
- Income → +1 coin (unblockable)  
- Foreign Aid → +2 coins (blocked by Duke)  
- Tax (Duke) → +3 coins  
- Assassinate (Assassin) → Pay 3 coins (blocked by Contessa)  
- Steal (Captain) → Take 2 coins (blocked by Captain/Ambassador)  
- Exchange (Ambassador) → Swap with deck  

### Core Mechanics
- Bluffing allowed  
- Players may challenge or block  
- Failed challenge → challenger loses influence  
- Successful challenge → actor loses influence  
- ≥7 coins → must Coup  
- Coup (7 coins) → target loses influence (unblockable)
- State machine: Turn Start → Action → Challenge → Block → Resolve → End Turn