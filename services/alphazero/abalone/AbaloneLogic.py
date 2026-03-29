"""
Core game logic for Abalone AlphaZero.

Board representation: 9×9 numpy array (dtype int8).
  - row = q + 4, col = r + 4
  - +1  = current player's marble (canonical form: current player is always +1)
  - -1  = opponent's marble
  -  0  = empty or off-board cell

The board is always stored in canonical form:
  current player = +1, opponent = -1.

AbaloneMove (returned as dict matching TypeScript AbaloneMove type):
  {"type": "inline"|"broadside", "marbles": [{"q":q,"r":r},...], "direction": 0-5}
"""

from __future__ import annotations
import numpy as np
from .AbaloneConstants import (
    CELLS, CELL_TO_IDX, NUM_CELLS, HEX_DIRS, opposite, LATERAL_DIRS,
    ACTION_SIZE, CAT_OFFSET, CAT_SIZE,
    encode_inline, decode_inline, encode_broadside, decode_broadside, decode_action,
    BLACK_START, WHITE_START,
    CELL_SYMMETRIES, ACTION_SYMMETRIES,
)

# ---------------------------------------------------------------------------
# Board helpers
# ---------------------------------------------------------------------------

def _cell(board: np.ndarray, q: int, r: int) -> int:
    """Read board value at (q,r). Returns 0 if off-board."""
    row, col = q + 4, r + 4
    if 0 <= row <= 8 and 0 <= col <= 8:
        return int(board[row, col])
    return 0


def _set(board: np.ndarray, q: int, r: int, value: int) -> None:
    board[q + 4, r + 4] = value


# ---------------------------------------------------------------------------
# Initial board
# ---------------------------------------------------------------------------

def get_init_board() -> np.ndarray:
    """
    Returns 9×9 int8 board in canonical form for player +1 (black, moves first).
    Black = +1, White = -1.
    """
    board = np.zeros((9, 9), dtype=np.int8)
    for q, r in BLACK_START:
        _set(board, q, r, 1)
    for q, r in WHITE_START:
        _set(board, q, r, -1)
    return board


# ---------------------------------------------------------------------------
# Canonical form
# ---------------------------------------------------------------------------

def get_canonical_form(board: np.ndarray, player: int) -> np.ndarray:
    """Multiply board by player so that current player is always +1."""
    if player == 1:
        return board
    return -board


# ---------------------------------------------------------------------------
# Action encode / decode helpers (re-exported for convenience)
# ---------------------------------------------------------------------------

def _get_marbles_inline(q: int, r: int, size: int, axis_dir: int) -> list[tuple[int, int]]:
    """
    Get the list of marble coords for an inline group of given size.
    tail (q, r) is the rearmost marble; marbles extend in axis_dir direction.
    """
    marbles = []
    cq, cr = q, r
    dq, dr = HEX_DIRS[axis_dir]
    for _ in range(size):
        marbles.append((cq, cr))
        cq += dq
        cr += dr
    return marbles


def _get_marbles_broadside(q: int, r: int, size: int, axis_dir: int, lat_dir: int) -> list[tuple[int, int]]:
    """
    Get the list of marble coords for a broadside group.
    tail (q, r) is one end; marbles extend along axis_dir for size total.
    Movement is in lat_dir.
    """
    marbles = []
    cq, cr = q, r
    dq, dr = HEX_DIRS[axis_dir]
    for _ in range(size):
        marbles.append((cq, cr))
        cq += dq
        cr += dr
    return marbles


# ---------------------------------------------------------------------------
# Move legality checks
# ---------------------------------------------------------------------------

def _is_valid_inline(board: np.ndarray, q: int, r: int, size: int, direction: int) -> bool:
    """
    Check if an inline move is valid.
    tail (q,r) is the rearmost marble; group extends in `direction`.
    """
    dq, dr = HEX_DIRS[direction]
    opp = opposite(direction)
    odq, odr = HEX_DIRS[opp]

    # All marbles must belong to current player (+1)
    cq, cr = q, r
    for _ in range(size):
        if _cell(board, cq, cr) != 1:
            return False
        cq += dq
        cr += dr

    # Head of group is at (cq - dq, cr - dr); cell just ahead is (cq, cr)
    # (cq, cr) is the cell after the head marble
    head_q, head_r = cq - dq, cr - dr

    # Cell immediately ahead of head
    front_q, front_r = cq, cr
    front_val = _cell(board, front_q, front_r)

    if front_val == 1:
        # Own marble blocking
        return False
    if front_val == 0:
        # Empty or off-board: valid move
        # Check head is actually on board (tail must be on board too, checked above)
        return (head_q, head_r) in CELL_TO_IDX
    # front_val == -1: potential sumito — count opponents
    opp_count = 0
    aq, ar = front_q, front_r
    while _cell(board, aq, ar) == -1:
        opp_count += 1
        aq += dq
        ar += dr

    if opp_count >= size:
        # Can't push equal or larger group
        return False

    # After opponents: must be empty or off-board (not own marble)
    after_val = _cell(board, aq, ar)
    if after_val == 1:
        return False
    # Valid sumito (after_val == 0: push last marble off board or into empty)
    return True


def _is_valid_broadside(board: np.ndarray, q: int, r: int, size: int, axis_dir: int, lat_dir: int) -> bool:
    """
    Check if a broadside move is valid.
    Marbles span from (q,r) along axis_dir for `size` marbles, moving in lat_dir.
    """
    dq, dr = HEX_DIRS[axis_dir]
    ldq, ldr = HEX_DIRS[lat_dir]

    cq, cr = q, r
    for _ in range(size):
        # Must be own marble
        if _cell(board, cq, cr) != 1:
            return False
        # Destination must be empty (broadside cannot push)
        nq, nr = cq + ldq, cr + ldr
        dest = _cell(board, nq, nr)
        if dest != 0:
            return False
        # Destination must be on board
        if (nq, nr) not in CELL_TO_IDX:
            return False
        cq += dq
        cr += dr
    return True


# ---------------------------------------------------------------------------
# Valid moves
# ---------------------------------------------------------------------------

def get_valid_moves(board: np.ndarray) -> np.ndarray:
    """
    Returns binary vector of length ACTION_SIZE.
    board must be in canonical form (current player = +1).
    """
    valid = np.zeros(ACTION_SIZE, dtype=np.int8)

    for cell_idx, (q, r) in enumerate(CELLS):
        if _cell(board, q, r) != 1:
            continue

        # Single inline (size=1): always valid if cell ahead is empty or sumito impossible
        # We check for all 6 directions
        for d in range(6):
            # --- Inline: size 1 ---
            action = encode_inline(cell_idx, 1, d)
            if _is_valid_inline(board, q, r, 1, d):
                valid[action] = 1

            # --- Inline: size 2 (this cell is tail) ---
            dq, dr = HEX_DIRS[d]
            nq, nr = q + dq, r + dr
            if _cell(board, nq, nr) == 1:
                action2 = encode_inline(cell_idx, 2, d)
                if _is_valid_inline(board, q, r, 2, d):
                    valid[action2] = 1

                # --- Inline: size 3 ---
                n2q, n2r = nq + dq, nr + dr
                if _cell(board, n2q, n2r) == 1:
                    action3 = encode_inline(cell_idx, 3, d)
                    if _is_valid_inline(board, q, r, 3, d):
                        valid[action3] = 1

            # --- Broadside: size 2 ---
            for lat_idx, lat_dir in enumerate(LATERAL_DIRS[d]):
                if _cell(board, nq, nr) == 1:
                    action_b2 = encode_broadside(cell_idx, 2, d, lat_idx)
                    if _is_valid_broadside(board, q, r, 2, d, lat_dir):
                        valid[action_b2] = 1

                    # --- Broadside: size 3 ---
                    n2q2, n2r2 = nq + dq, nr + dr
                    if _cell(board, n2q2, n2r2) == 1:
                        action_b3 = encode_broadside(cell_idx, 3, d, lat_idx)
                        if _is_valid_broadside(board, q, r, 3, d, lat_dir):
                            valid[action_b3] = 1

    return valid


# ---------------------------------------------------------------------------
# Apply move
# ---------------------------------------------------------------------------

def _apply_inline(board: np.ndarray, q: int, r: int, size: int, direction: int) -> np.ndarray:
    """Apply an inline move. Returns a new board."""
    board = board.copy()
    dq, dr = HEX_DIRS[direction]

    # Collect all marbles in the push chain (own + opponent)
    chain: list[tuple[int, int, int]] = []  # (q, r, value)
    cq, cr = q, r
    for _ in range(size):
        chain.append((cq, cr, 1))
        cq += dq
        cr += dr

    # Count and collect opponent marbles being pushed
    while _cell(board, cq, cr) == -1:
        chain.append((cq, cr, -1))
        cq += dq
        cr += dr

    # Move chain one step forward (from head to tail to avoid overwrites)
    for i in range(len(chain) - 1, -1, -1):
        mq, mr, val = chain[i]
        nq, nr = mq + dq, mr + dr
        # If destination is off board, marble is captured (just clear source)
        if (nq, nr) in CELL_TO_IDX:
            _set(board, nq, nr, val)
        _set(board, mq, mr, 0)

    return board


def _apply_broadside(board: np.ndarray, q: int, r: int, size: int, axis_dir: int, lat_dir: int) -> np.ndarray:
    """Apply a broadside move. Returns a new board."""
    board = board.copy()
    dq, dr = HEX_DIRS[axis_dir]
    ldq, ldr = HEX_DIRS[lat_dir]

    marbles = _get_marbles_broadside(q, r, size, axis_dir, lat_dir)

    # Move each marble one step in lat_dir
    for mq, mr in marbles:
        _set(board, mq + ldq, mr + ldr, 1)
        _set(board, mq, mr, 0)

    return board


def get_next_state(board: np.ndarray, action: int) -> tuple[np.ndarray, int]:
    """
    Apply action to canonical board. Returns (new_canonical_board, next_player=-1).
    The returned board is negated so MCTS can apply getCanonicalForm(-1) to restore.
    """
    move_type, tail_idx, size, direction, lat_idx = decode_action(action)
    q, r = CELLS[tail_idx]

    if move_type == "inline":
        new_board = _apply_inline(board, q, r, size, direction)
    else:
        lat_dir = LATERAL_DIRS[direction][lat_idx]
        new_board = _apply_broadside(board, q, r, size, direction, lat_dir)

    # Return from next player's perspective: negate board
    return -new_board, -1


# ---------------------------------------------------------------------------
# Game end detection
# ---------------------------------------------------------------------------

def get_game_ended(board: np.ndarray, player: int, move_number: int) -> float:
    """
    Returns:
      0   if game not ended
      1   if current player (player) won
     -1   if current player lost
      1e-4 for draw (move_number >= 200)
    board is in canonical form (current player = +1).
    """
    # Count marbles for current player (+1) and opponent (-1)
    own = int(np.sum(board == 1))
    opp = int(np.sum(board == -1))

    if opp <= 8:
        return 1   # current player won (pushed 6+ opponent marbles)
    if own <= 8:
        return -1  # current player lost

    if move_number >= 200:
        return 1e-4  # draw

    return 0


# ---------------------------------------------------------------------------
# String representation for MCTS hashing
# ---------------------------------------------------------------------------

def string_representation(board: np.ndarray) -> bytes:
    return board.tobytes()


# ---------------------------------------------------------------------------
# Symmetries
# ---------------------------------------------------------------------------

def get_symmetries(board: np.ndarray, pi: list[float]) -> list[tuple[np.ndarray, list[float]]]:
    """Apply 12 dihedral symmetries to board and policy vector."""
    result = []
    pi_arr = np.array(pi)

    for cell_perm, action_perm in zip(CELL_SYMMETRIES, ACTION_SYMMETRIES):
        # Apply cell permutation to board: rearrange the 9×9 grid
        new_board = np.zeros((9, 9), dtype=np.int8)
        for old_idx, new_idx in enumerate(cell_perm):
            oq, or_ = CELLS[old_idx]
            nq, nr = CELLS[new_idx]
            new_board[nq + 4, nr + 4] = board[oq + 4, or_ + 4]

        # Apply action permutation to policy
        new_pi = pi_arr[action_perm]
        result.append((new_board, new_pi.tolist()))

    return result


# ---------------------------------------------------------------------------
# Action → AbaloneMove dict (for server response)
# ---------------------------------------------------------------------------

def action_to_move_dict(action: int) -> dict:
    """
    Convert action integer to AbaloneMove dict matching TypeScript type:
      {"type": "inline"|"broadside", "marbles": [{"q":q,"r":r},...], "direction": 0-5}
    """
    move_type, tail_idx, size, direction, lat_idx = decode_action(action)
    q, r = CELLS[tail_idx]

    if move_type == "inline":
        marbles = _get_marbles_inline(q, r, size, direction)
    else:
        lat_dir = LATERAL_DIRS[direction][lat_idx]
        marbles = _get_marbles_broadside(q, r, size, direction, lat_dir)

    return {
        "type": move_type,
        "marbles": [{"q": mq, "r": mr} for mq, mr in marbles],
        "direction": direction if move_type == "inline" else LATERAL_DIRS[direction][lat_idx],
    }


# ---------------------------------------------------------------------------
# Board → 9×9 matrix from TypeScript AbaloneState-style dict
# (used by server to convert incoming state from the bot)
# ---------------------------------------------------------------------------

def state_to_board(board_dict: dict, seat0_id: str) -> np.ndarray:
    """
    Convert TypeScript AbaloneState board (dict of "q,r" -> cell) to 9×9 numpy board.
    seat0_id is the PlayerId of seat 0 (black, +1).
    player argument indicates whose turn it is: 1 or -1.
    Returns board in RAW form (not canonical).
    """
    board = np.zeros((9, 9), dtype=np.int8)
    for key, cell in board_dict.items():
        if cell.get("kind") != "marble":
            continue
        q_str, r_str = key.split(",")
        q, r = int(q_str), int(r_str)
        value = 1 if cell["owner"] == seat0_id else -1
        board[q + 4, r + 4] = value
    return board
