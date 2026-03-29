"""
Unit tests for Phase 1: AbaloneConstants + AbaloneLogic + AbaloneGame.
Run from services/alphazero/ directory: python -m abalone.test_abalone
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np
import unittest

from abalone.AbaloneConstants import (
    CELLS, CELL_TO_IDX, NUM_CELLS, HEX_DIRS, opposite, LATERAL_DIRS,
    ACTION_SIZE, CAT_OFFSET, encode_inline, decode_inline,
    encode_broadside, decode_broadside, decode_action,
    BLACK_START, WHITE_START, CELL_SYMMETRIES, ACTION_SYMMETRIES,
)
from abalone.AbaloneLogic import (
    get_init_board, get_canonical_form, get_valid_moves,
    get_next_state, get_game_ended, action_to_move_dict, _cell, _set,
)
from abalone.AbaloneGame import AbaloneGame


class TestConstants(unittest.TestCase):
    def test_valid_cell_count(self):
        self.assertEqual(NUM_CELLS, 61)

    def test_cell_to_idx_roundtrip(self):
        for idx, (q, r) in enumerate(CELLS):
            self.assertEqual(CELL_TO_IDX[(q, r)], idx)

    def test_opposite_direction(self):
        for d in range(6):
            self.assertEqual(opposite(opposite(d)), d)
            self.assertEqual((d + 3) % 6, opposite(d))

    def test_lateral_dirs_count(self):
        for d in range(6):
            self.assertEqual(len(LATERAL_DIRS[d]), 4)
            self.assertNotIn(d, LATERAL_DIRS[d])
            self.assertNotIn(opposite(d), LATERAL_DIRS[d])

    def test_action_size(self):
        self.assertEqual(ACTION_SIZE, 4026)

    def test_starting_marble_counts(self):
        self.assertEqual(len(BLACK_START), 14)
        self.assertEqual(len(WHITE_START), 14)

    def test_symmetry_count(self):
        self.assertEqual(len(CELL_SYMMETRIES), 12)
        self.assertEqual(len(ACTION_SYMMETRIES), 12)

    def test_cell_symmetry_is_permutation(self):
        for perm in CELL_SYMMETRIES:
            self.assertEqual(sorted(perm), list(range(61)))

    def test_action_symmetry_is_permutation(self):
        for perm in ACTION_SYMMETRIES:
            self.assertEqual(sorted(perm), list(range(ACTION_SIZE)))


class TestEncodeDecode(unittest.TestCase):
    def test_inline_roundtrip_all(self):
        """Every inline action encodes and decodes to the same values."""
        for action in range(CAT_OFFSET[3]):
            tail_idx, size, direction = decode_inline(action)
            reencoded = encode_inline(tail_idx, size, direction)
            self.assertEqual(action, reencoded, f"Inline roundtrip failed at action {action}")

    def test_broadside_roundtrip_all(self):
        """Every broadside action encodes and decodes to the same values."""
        for action in range(CAT_OFFSET[3], ACTION_SIZE):
            tail_idx, size, axis_dir, lat_idx = decode_broadside(action)
            reencoded = encode_broadside(tail_idx, size, axis_dir, lat_idx)
            self.assertEqual(action, reencoded, f"Broadside roundtrip failed at action {action}")

    def test_inline_ranges(self):
        """Inline categories cover correct cell and direction ranges."""
        for size in (1, 2, 3):
            for cell_idx in range(61):
                for d in range(6):
                    a = encode_inline(cell_idx, size, d)
                    ti, sz, di = decode_inline(a)
                    self.assertEqual(ti, cell_idx)
                    self.assertEqual(sz, size)
                    self.assertEqual(di, d)

    def test_broadside_ranges(self):
        for size in (2, 3):
            for cell_idx in range(61):
                for axis_dir in range(6):
                    for lat_idx in range(4):
                        a = encode_broadside(cell_idx, size, axis_dir, lat_idx)
                        ti, sz, ad, li = decode_broadside(a)
                        self.assertEqual(ti, cell_idx)
                        self.assertEqual(sz, size)
                        self.assertEqual(ad, axis_dir)
                        self.assertEqual(li, lat_idx)

    def test_decode_action_type(self):
        for action in range(ACTION_SIZE):
            move_type, tail_idx, size, direction, lat_idx = decode_action(action)
            if action < CAT_OFFSET[3]:
                self.assertEqual(move_type, "inline")
                self.assertIn(size, (1, 2, 3))
            else:
                self.assertEqual(move_type, "broadside")
                self.assertIn(size, (2, 3))


class TestInitBoard(unittest.TestCase):
    def setUp(self):
        self.board = get_init_board()

    def test_shape(self):
        self.assertEqual(self.board.shape, (9, 9))

    def test_black_marble_count(self):
        self.assertEqual(int(np.sum(self.board == 1)), 14)

    def test_white_marble_count(self):
        self.assertEqual(int(np.sum(self.board == -1)), 14)

    def test_black_positions(self):
        for q, r in BLACK_START:
            self.assertEqual(_cell(self.board, q, r), 1,
                             f"Expected black marble at ({q},{r})")

    def test_white_positions(self):
        for q, r in WHITE_START:
            self.assertEqual(_cell(self.board, q, r), -1,
                             f"Expected white marble at ({q},{r})")


class TestCanonicalForm(unittest.TestCase):
    def test_player1_unchanged(self):
        board = get_init_board()
        canon = get_canonical_form(board, 1)
        np.testing.assert_array_equal(canon, board)

    def test_player_neg1_negated(self):
        board = get_init_board()
        canon = get_canonical_form(board, -1)
        np.testing.assert_array_equal(canon, -board)


class TestValidMoves(unittest.TestCase):
    def setUp(self):
        self.board = get_init_board()
        self.valid = get_valid_moves(self.board)

    def test_valid_vector_length(self):
        self.assertEqual(len(self.valid), ACTION_SIZE)

    def test_valid_values_binary(self):
        self.assertTrue(set(self.valid.tolist()).issubset({0, 1}))

    def test_opening_has_moves(self):
        n = int(np.sum(self.valid))
        self.assertGreater(n, 0, "No valid moves from opening position")
        # Standard Abalone opening: typically 44 valid moves
        # (allow a range in case our encoding counts groups differently)
        self.assertGreaterEqual(n, 30)
        self.assertLessEqual(n, 100)
        print(f"\nOpening valid move count: {n}")


class TestApplyMove(unittest.TestCase):
    def _make_board(self, own: list[tuple[int,int]], opp: list[tuple[int,int]]) -> np.ndarray:
        board = np.zeros((9, 9), dtype=np.int8)
        for q, r in own:
            _set(board, q, r, 1)
        for q, r in opp:
            _set(board, q, r, -1)
        return board

    def test_single_inline_move(self):
        """Move a single marble from (0,0) east to (1,0)."""
        board = self._make_board([(0, 0)], [])
        tail_idx = CELL_TO_IDX[(0, 0)]
        action = encode_inline(tail_idx, 1, 0)  # dir 0 = E
        new_board, next_player = get_next_state(board, action)
        self.assertEqual(next_player, -1)
        # From next player's perspective board is negated, so our marble is now -1
        # Original (1,0) in our frame is now occupied by us (val 1 before negation)
        # After negation, our marble at (1,0) shows as -1
        self.assertEqual(new_board[1 + 4, 0 + 4], -1)  # (1,0): was our marble, now negated
        self.assertEqual(new_board[0 + 4, 0 + 4], 0)   # (0,0) is now empty

    def test_sumito_2v1(self):
        """2-marble group pushes 1 opponent marble."""
        # Black at (0,0) and (-1,0), white at (1,0). Push E (dir=0).
        # tail is (-1,0), group: (-1,0),(0,0), pushing (1,0) off into (2,0).
        board = self._make_board([(-1, 0), (0, 0)], [(1, 0)])
        tail_idx = CELL_TO_IDX[(-1, 0)]
        action = encode_inline(tail_idx, 2, 0)  # dir 0 = E
        valid = get_valid_moves(board)
        self.assertEqual(valid[action], 1, "2v1 sumito should be valid")
        new_board, _ = get_next_state(board, action)
        # After move (and negation): (1,0) has our marble (shows as -1), (2,0) has opponent (shows as +1)
        self.assertEqual(new_board[1 + 4, 0 + 4], -1)  # our marble moved here
        self.assertEqual(new_board[2 + 4, 0 + 4], 1)   # opponent pushed here

    def test_sumito_2v2_blocked(self):
        """2-marble group cannot push 2 opponent marbles."""
        board = self._make_board([(-1, 0), (0, 0)], [(1, 0), (2, 0)])
        tail_idx = CELL_TO_IDX[(-1, 0)]
        action = encode_inline(tail_idx, 2, 0)
        valid = get_valid_moves(board)
        self.assertEqual(valid[action], 0, "2v2 sumito should be invalid")

    def test_sumito_push_off_board(self):
        """3-marble group pushes 1 opponent marble off the board edge."""
        # Black at (-2,4),(-1,4),(0,4); white at (1,3) — push in NE dir=1: (1,-1)
        # Actually let's use a simpler edge push. Push E (dir=0) near edge.
        # Black at (2,0),(3,0),(4,0) doesn't work; let's use: black (-1,4),(0,4),(1,4) no...
        # Use: black at (1,0),(2,0),(3,0), white at (4,0). Push E -> white lands at (5,0) which is off-board.
        board = self._make_board([(1, 0), (2, 0), (3, 0)], [(4, 0)])
        tail_idx = CELL_TO_IDX[(1, 0)]
        action = encode_inline(tail_idx, 3, 0)
        valid = get_valid_moves(board)
        self.assertEqual(valid[action], 1, "3v1 push-off should be valid")
        new_board, _ = get_next_state(board, action)
        # After push: white marble at (4,0) moves to (5,0) which is off-board -> captured
        # Our marbles moved: (1,0)->(2,0), (2,0)->(3,0), (3,0)->(4,0)
        # After negation: (4,0) shows as -1 (our marble), (5,0) is off-board
        self.assertEqual(new_board[4 + 4, 0 + 4], -1)  # our front marble
        # White was at (4,0), pushed to off-board — count whites in new board (after negation: whites show as +1)
        white_count = int(np.sum(new_board == 1))
        # Before: 1 white. After push off board: 0 whites. After negation: they become +1.
        self.assertEqual(white_count, 0)

    def test_broadside_move(self):
        """2 marbles move broadside."""
        # Black at (0,0) and (1,0) (axis E=0), move SW (lat dir=4)
        board = self._make_board([(0, 0), (1, 0)], [])
        tail_idx = CELL_TO_IDX[(0, 0)]
        axis_dir = 0  # E
        # Find lat_idx for SW (dir 4) in LATERAL_DIRS[0]
        lat_idx = LATERAL_DIRS[0].index(4)
        action = encode_broadside(tail_idx, 2, axis_dir, lat_idx)
        valid = get_valid_moves(board)
        self.assertEqual(valid[action], 1, "Broadside 2 should be valid")
        new_board, _ = get_next_state(board, action)
        # SW = (-1,1): (0,0)->(-1,1), (1,0)->(0,1)
        # After negation: our marbles show as -1
        self.assertEqual(new_board[-1 + 4, 1 + 4], -1)
        self.assertEqual(new_board[0 + 4, 1 + 4], -1)
        self.assertEqual(new_board[0 + 4, 0 + 4], 0)
        self.assertEqual(new_board[1 + 4, 0 + 4], 0)


class TestGameEnded(unittest.TestCase):
    def test_no_end_at_start(self):
        board = get_init_board()
        result = get_game_ended(board, 1, 0)
        self.assertEqual(result, 0)

    def test_win_condition(self):
        board = np.zeros((9, 9), dtype=np.int8)
        # Current player has 14, opponent has 8 (= 6 pushed off from 14)
        for i, (q, r) in enumerate(CELLS[:14]):
            _set(board, q, r, 1)
        for i, (q, r) in enumerate(CELLS[20:28]):  # 8 opponent marbles
            _set(board, q, r, -1)
        result = get_game_ended(board, 1, 0)
        self.assertEqual(result, 1)

    def test_loss_condition(self):
        board = np.zeros((9, 9), dtype=np.int8)
        # Current player has 8 (= 6 pushed off), opponent has 14
        for i, (q, r) in enumerate(CELLS[:8]):
            _set(board, q, r, 1)
        for i, (q, r) in enumerate(CELLS[20:34]):
            _set(board, q, r, -1)
        result = get_game_ended(board, 1, 0)
        self.assertEqual(result, -1)

    def test_draw_at_move_limit(self):
        board = get_init_board()
        result = get_game_ended(board, 1, 200)
        self.assertAlmostEqual(result, 1e-4)


class TestActionToMoveDict(unittest.TestCase):
    def test_inline_dict_structure(self):
        action = encode_inline(CELL_TO_IDX[(0, 0)], 1, 0)
        move = action_to_move_dict(action)
        self.assertEqual(move["type"], "inline")
        self.assertEqual(len(move["marbles"]), 1)
        self.assertEqual(move["marbles"][0], {"q": 0, "r": 0})
        self.assertIn("direction", move)

    def test_broadside_dict_structure(self):
        # 2-marble broadside
        action = encode_broadside(CELL_TO_IDX[(0, 0)], 2, 0, 0)
        move = action_to_move_dict(action)
        self.assertEqual(move["type"], "broadside")
        self.assertEqual(len(move["marbles"]), 2)
        self.assertIn("direction", move)

    def test_direction_is_int(self):
        for d in range(6):
            action = encode_inline(CELL_TO_IDX[(0, 0)], 1, d)
            move = action_to_move_dict(action)
            self.assertIsInstance(move["direction"], int)


class TestAbaloneGame(unittest.TestCase):
    def test_board_size(self):
        game = AbaloneGame()
        self.assertEqual(game.getBoardSize(), (9, 9))

    def test_action_size(self):
        game = AbaloneGame()
        self.assertEqual(game.getActionSize(), 4026)

    def test_init_board_marbles(self):
        game = AbaloneGame()
        board = game.getInitBoard()
        self.assertEqual(int(np.sum(board == 1)), 14)
        self.assertEqual(int(np.sum(board == -1)), 14)

    def test_get_valid_moves_returns_correct_length(self):
        game = AbaloneGame()
        board = game.getInitBoard()
        valid = game.getValidMoves(board, 1)
        self.assertEqual(len(valid), 4026)

    def test_next_state_flips_player(self):
        game = AbaloneGame()
        board = game.getInitBoard()
        valid = game.getValidMoves(board, 1)
        actions = np.where(valid == 1)[0]
        _, next_player = game.getNextState(board, 1, int(actions[0]))
        self.assertEqual(next_player, -1)

    def test_symmetries_count(self):
        game = AbaloneGame()
        board = game.getInitBoard()
        pi = [0.0] * 4026
        syms = game.getSymmetries(board, pi)
        self.assertEqual(len(syms), 12)


if __name__ == "__main__":
    unittest.main(verbosity=2)
