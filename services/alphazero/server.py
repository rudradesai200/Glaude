"""
Phase 4: FastAPI sidecar for Abalone AI.

POST /move  — given game state, returns the AI's AbaloneMove
GET  /health — liveness check
"""

import logging
import os
import sys

import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "framework"))

from abalone.AbaloneGame import AbaloneGame
from abalone.AbaloneLogic import action_to_move_dict, get_canonical_form, state_to_board
from abalone.pytorch.NNet import NNetWrapper
from framework.MCTS import MCTS
from framework.utils import dotdict

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# ---------------------------------------------------------------------------
# MCTS args — tuned conservatively for inference latency
# ---------------------------------------------------------------------------
MCTS_ARGS = dotdict({
    "numMCTSSims": 25,
    "cpuct": 1,
})

CHECKPOINT_DIR = os.environ.get("CHECKPOINT_DIR", "./temp")
CHECKPOINT_FILE = os.environ.get("CHECKPOINT_FILE", "best.pth.tar")

# ---------------------------------------------------------------------------
# App-level singletons (loaded once at startup)
# ---------------------------------------------------------------------------
app = FastAPI(title="Glaude AlphaZero — Abalone")

_game: AbaloneGame
_nnet: NNetWrapper


@app.on_event("startup")
def load_model() -> None:
    global _game, _nnet

    log.info("Loading AbaloneGame...")
    _game = AbaloneGame()

    log.info("Loading NNetWrapper...")
    _nnet = NNetWrapper(_game)

    checkpoint_path = os.path.join(CHECKPOINT_DIR, CHECKPOINT_FILE)
    if os.path.exists(checkpoint_path):
        log.info("Loading checkpoint from %s", checkpoint_path)
        _nnet.load_checkpoint(CHECKPOINT_DIR, CHECKPOINT_FILE)
    else:
        log.warning(
            "No checkpoint found at %s — using untrained network", checkpoint_path
        )


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------
class Cell(BaseModel):
    kind: str
    owner: str | None = None


class MoveRequest(BaseModel):
    board: dict[str, Cell]
    turn: str
    players: list[str]  # players[0] = seat 0 (black/+1), players[1] = seat 1 (white/-1)
    moveNumber: int
    capturedBy: dict = {}


class Marble(BaseModel):
    q: int
    r: int


class MoveResponse(BaseModel):
    type: str
    marbles: list[Marble]
    direction: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/move", response_model=MoveResponse)
def get_move(req: MoveRequest) -> MoveResponse:
    if len(req.players) != 2:
        raise HTTPException(status_code=400, detail="players must have exactly 2 entries")

    seat0_id = req.players[0]
    seat1_id = req.players[1]

    if req.turn not in (seat0_id, seat1_id):
        raise HTTPException(status_code=400, detail="turn must be one of the two players")

    # Convert board dict to raw 9×9 numpy (seat0=+1, seat1=-1)
    board_dict = {k: v.model_dump() for k, v in req.board.items()}
    raw_board = state_to_board(board_dict, seat0_id)

    # Canonical form: current player always +1
    player = 1 if req.turn == seat0_id else -1
    _game._move_number = req.moveNumber
    canonical_board = get_canonical_form(raw_board, player)

    # Fresh MCTS per request (no stale tree cache between independent positions)
    mcts = MCTS(_game, _nnet, MCTS_ARGS)
    probs = mcts.getActionProb(canonical_board, temp=0)
    action = int(np.argmax(probs))

    move = action_to_move_dict(action)
    return MoveResponse(
        type=move["type"],
        marbles=[Marble(q=m["q"], r=m["r"]) for m in move["marbles"]],
        direction=move["direction"],
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
