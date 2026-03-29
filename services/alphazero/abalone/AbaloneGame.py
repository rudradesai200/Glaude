"""
AbaloneGame: thin framework wrapper delegating to AbaloneLogic.
Subclasses Game from the alpha-zero-general framework.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "framework"))

from Game import Game
from .AbaloneLogic import (
    get_init_board,
    get_canonical_form,
    get_valid_moves,
    get_next_state,
    get_game_ended,
    string_representation,
    get_symmetries,
)
from .AbaloneConstants import ACTION_SIZE


class AbaloneGame(Game):
    def __init__(self):
        super().__init__()
        self._move_number = 0  # tracked externally per MCTS simulation

    def getInitBoard(self):
        return get_init_board()

    def getBoardSize(self):
        return (9, 9)

    def getActionSize(self):
        return ACTION_SIZE  # 4026

    def getNextState(self, board, player, action):
        new_board, next_player = get_next_state(board, action)
        return new_board, next_player

    def getValidMoves(self, board, player):
        # board is already in canonical form (current player = +1)
        return get_valid_moves(board)

    def getGameEnded(self, board, player):
        # We don't have move_number in the framework API; use a default large value
        # The caller (server/train) can pass move_number by subclassing or monkey-patching.
        # For self-play we track it externally; here we pass 0 (no draw by default).
        return get_game_ended(board, player, self._move_number)

    def getCanonicalForm(self, board, player):
        return get_canonical_form(board, player)

    def getSymmetries(self, board, pi):
        return get_symmetries(board, pi)

    def stringRepresentation(self, board):
        return string_representation(board)
