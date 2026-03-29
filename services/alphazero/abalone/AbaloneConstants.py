"""
Precomputed constants for Abalone AlphaZero.

Coordinate system: axial (q, r), valid cells where max(|q|,|r|,|q+r|) <= 4.
Board values: +1 = current player's marble, -1 = opponent's, 0 = empty/off-board.
HexDir: 0=E(1,0), 1=NE(1,-1), 2=NW(0,-1), 3=W(-1,0), 4=SW(-1,1), 5=SE(0,1)
"""

import numpy as np

# ---------------------------------------------------------------------------
# Valid cells: 61 axial coords in row-major (q then r) scan order
# ---------------------------------------------------------------------------
CELLS = []  # list of (q, r) tuples, index 0..60
for _q in range(-4, 5):
    for _r in range(-4, 5):
        if max(abs(_q), abs(_r), abs(_q + _r)) <= 4:
            CELLS.append((_q, _r))

CELL_TO_IDX = {cell: idx for idx, cell in enumerate(CELLS)}
NUM_CELLS = len(CELLS)  # 61

# ---------------------------------------------------------------------------
# Hex directions: index matches HexDir enum in TypeScript
# (dq, dr): 0=E, 1=NE, 2=NW, 3=W, 4=SW, 5=SE
# ---------------------------------------------------------------------------
HEX_DIRS = [
    (1,  0),   # 0: E
    (1, -1),   # 1: NE
    (0, -1),   # 2: NW
    (-1,  0),  # 3: W
    (-1,  1),  # 4: SW
    (0,  1),   # 5: SE
]

def opposite(d: int) -> int:
    return (d + 3) % 6

# For broadside moves: the 4 directions that are NOT parallel to the group axis.
# For axis d, lateral dirs are all 6 dirs except d and opposite(d), sorted for determinism.
LATERAL_DIRS: list[list[int]] = []
for _d in range(6):
    _opp = opposite(_d)
    _laterals = sorted([x for x in range(6) if x != _d and x != _opp])
    LATERAL_DIRS.append(_laterals)

# ---------------------------------------------------------------------------
# Action space: 4026 total
# Category offsets:
#   0: single inline  (61 * 6 = 366)
#   1: 2-marble inline (61 * 6 = 366)  offset 366
#   2: 3-marble inline (61 * 6 = 366)  offset 732
#   3: 2-marble broadside (61 * 6 * 4 = 1464) offset 1098
#   4: 3-marble broadside (61 * 6 * 4 = 1464) offset 2562
# ---------------------------------------------------------------------------
ACTION_SIZE = 4026

CAT_OFFSET = [0, 366, 732, 1098, 2562]
CAT_SIZE   = [366, 366, 366, 1464, 1464]

# Inline encode: action = CAT_OFFSET[size-1] + cell_idx * 6 + dir
# Broadside encode: action = CAT_OFFSET[2+size] + cell_idx * 24 + dir * 4 + lat_idx
# where lat_idx is index into LATERAL_DIRS[dir]


def encode_inline(tail_idx: int, size: int, direction: int) -> int:
    """Encode inline move. size in {1,2,3}. Returns action integer."""
    return CAT_OFFSET[size - 1] + tail_idx * 6 + direction


def decode_inline(action: int) -> tuple[int, int, int]:
    """Returns (tail_idx, size, direction)."""
    for size in range(1, 4):
        cat = size - 1
        local = action - CAT_OFFSET[cat]
        if 0 <= local < CAT_SIZE[cat]:
            tail_idx = local // 6
            direction = local % 6
            return tail_idx, size, direction
    raise ValueError(f"Action {action} is not an inline move")


def encode_broadside(tail_idx: int, size: int, axis_dir: int, lat_idx: int) -> int:
    """Encode broadside move. size in {2,3}. lat_idx is index into LATERAL_DIRS[axis_dir]."""
    cat = 2 + size  # cat 3 for size=1... actually size in {2,3}: cat = size+1 for 2->3, size+1 for 3->4
    # size=2 -> cat index 3, size=3 -> cat index 4
    cat = 1 + size  # size=2->3, size=3->4
    return CAT_OFFSET[cat] + tail_idx * 24 + axis_dir * 4 + lat_idx


def decode_broadside(action: int) -> tuple[int, int, int, int]:
    """Returns (tail_idx, size, axis_dir, lat_idx)."""
    for size in (2, 3):
        cat = 1 + size
        local = action - CAT_OFFSET[cat]
        if 0 <= local < CAT_SIZE[cat]:
            tail_idx = local // 24
            remainder = local % 24
            axis_dir = remainder // 4
            lat_idx = remainder % 4
            return tail_idx, size, axis_dir, lat_idx
    raise ValueError(f"Action {action} is not a broadside move")


def decode_action(action: int) -> tuple[str, int, int, int, int]:
    """
    Returns (move_type, tail_idx, size, direction, lat_idx)
    move_type: "inline" or "broadside"
    lat_idx is 0 for inline moves (unused).
    """
    if action < CAT_OFFSET[3]:
        tail_idx, size, direction = decode_inline(action)
        return "inline", tail_idx, size, direction, 0
    else:
        tail_idx, size, axis_dir, lat_idx = decode_broadside(action)
        return "broadside", tail_idx, size, axis_dir, lat_idx


# ---------------------------------------------------------------------------
# Standard starting positions (matches TypeScript board.ts)
# Black (seat 0, +1): r=-4, r=-3, and r=-2 with q in {-1,0,1}
# White (seat 1, -1): r=4,  r=3,  and r=2  with q in {-1,0,1}
# ---------------------------------------------------------------------------
BLACK_START = [(q, r) for (q, r) in CELLS
               if r == -4 or r == -3 or (r == -2 and -1 <= q <= 1)]

WHITE_START = [(q, r) for (q, r) in CELLS
               if r == 4 or r == 3 or (r == 2 and -1 <= q <= 1)]

assert len(BLACK_START) == 14, f"Expected 14 black marbles, got {len(BLACK_START)}"
assert len(WHITE_START) == 14, f"Expected 14 white marbles, got {len(WHITE_START)}"

# ---------------------------------------------------------------------------
# Symmetry permutation tables (Dihedral-6: 12 symmetries)
# Rotation by 60° in axial coords: (q, r) -> (-r, q+r)
# Reflection across q-axis:        (q, r) -> (q+r, -r)
# ---------------------------------------------------------------------------

def _rotate60(q: int, r: int) -> tuple[int, int]:
    """60° CCW rotation in axial coordinates."""
    return (-r, q + r)

def _reflect(q: int, r: int) -> tuple[int, int]:
    """Reflection across q=0 axis."""
    return (q + r, -r)

def _build_cell_perm(transform) -> list[int]:
    """Build a permutation table for cells under the given transform."""
    perm = []
    for q, r in CELLS:
        nq, nr = transform(q, r)
        perm.append(CELL_TO_IDX[(nq, nr)])
    return perm


# 6 rotations
def _rot_n(n):
    def f(q, r):
        for _ in range(n):
            q, r = _rotate60(q, r)
        return q, r
    return f

# 6 rotations × 2 (with and without reflection)
CELL_SYMMETRIES: list[list[int]] = []
for _n in range(6):
    rot = _rot_n(_n)
    CELL_SYMMETRIES.append(_build_cell_perm(rot))
    def _ref_then_rot(q, r, n=_n):
        q, r = _reflect(q, r)
        for _ in range(n):
            q, r = _rotate60(q, r)
        return q, r
    CELL_SYMMETRIES.append(_build_cell_perm(_ref_then_rot))


def _build_action_perm(cell_perm: list[int]) -> list[int]:
    """
    Build a permutation table for the action space under a cell permutation.
    For each action, decode it, transform cell indices and directions, re-encode.
    """
    # Build reverse cell lookup: new_idx -> old coords
    inv_cell = {new_idx: CELLS[old_idx] for old_idx, new_idx in enumerate(cell_perm)}

    # Precompute transformed direction: for each cell and direction,
    # which direction does the transformed cell point in after applying the cell perm?
    # We'll determine the direction transform from the first valid cell's neighbor mapping.
    # All cells share the same direction transformation under a rigid symmetry.
    # Find the direction permutation from any valid cell.
    dir_perm: list[int] = []
    for d in range(6):
        dq, dr = HEX_DIRS[d]
        # Pick the first cell whose neighbor in dir d is also on the board
        for q, r in CELLS:
            nq, nr = q + dq, r + dr
            if (nq, nr) in CELL_TO_IDX:
                orig_idx = CELL_TO_IDX[(q, r)]
                neighbor_idx = CELL_TO_IDX[(nq, nr)]
                new_orig = cell_perm[orig_idx]
                new_neighbor = cell_perm[neighbor_idx]
                tq0, tr0 = CELLS[new_orig]
                tq1, tr1 = CELLS[new_neighbor]
                tdq, tdr = tq1 - tq0, tr1 - tr0
                new_d = HEX_DIRS.index((tdq, tdr))
                dir_perm.append(new_d)
                break

    # Now build the full action permutation
    action_perm = list(range(ACTION_SIZE))
    for action in range(ACTION_SIZE):
        if action < CAT_OFFSET[3]:
            # inline
            tail_idx, size, direction = decode_inline(action)
            new_tail = cell_perm[tail_idx]
            new_dir = dir_perm[direction]
            action_perm[action] = encode_inline(new_tail, size, new_dir)
        else:
            # broadside
            tail_idx, size, axis_dir, lat_idx = decode_broadside(action)
            new_tail = cell_perm[tail_idx]
            new_axis = dir_perm[axis_dir]
            orig_lat = LATERAL_DIRS[axis_dir][lat_idx]
            new_lat_dir = dir_perm[orig_lat]
            new_lat_idx = LATERAL_DIRS[new_axis].index(new_lat_dir)
            action_perm[action] = encode_broadside(new_tail, size, new_axis, new_lat_idx)
    return action_perm


ACTION_SYMMETRIES: list[list[int]] = [
    _build_action_perm(cp) for cp in CELL_SYMMETRIES
]

assert len(CELL_SYMMETRIES) == 12
assert len(ACTION_SYMMETRIES) == 12
