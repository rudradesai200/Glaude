# Phase 3 Context: AlphaZero Training Pipeline

## Status
Phase 2 complete. ResNet neural network implemented.

## Files Created (Phase 2)
```
services/alphazero/abalone/pytorch/
  AbaloneNNet.py   — ResNet architecture (3-ch input, 5 residual blocks × 128ch, policy + value heads)
  NNet.py          — NNetWrapper subclass (3-channel board tensor, train/predict/save/load)
```

## Key Details (Phase 2)
- Input tensor: (batch, 3, 9, 9) — own marbles, opp marbles, valid-cell mask
- Spatial dims stay 9×9 throughout (all convs use padding=1)
- Flatten size before FC: 128 × 9 × 9 = 10368
- Policy head: FC(10368→512) → dropout → FC(512→4026) → log_softmax
- Value head: FC(10368→256) → dropout → FC(256→1) → tanh
- Args: lr=0.001, dropout=0.3, epochs=10, batch_size=64, num_channels=128

## Phase 3 Files to Create

### `abalone/train.py`
Entry point for self-play training. Wires together `AbaloneGame`, `NNetWrapper`, and `Coach` from the framework.

```python
from abalone.AbaloneGame import AbaloneGame
from abalone.pytorch.NNet import NNetWrapper as nn
from framework.Coach import Coach
from utils import dotdict

args = dotdict({
    'numIters': 1000,
    'numEps': 100,
    'tempThreshold': 15,
    'updateThreshold': 0.6,
    'maxlenOfQueue': 200000,
    'numMCTSSims': 25,
    'arenaCompare': 40,
    'cpuct': 1,
    'checkpoint': './temp/',
    'load_model': False,
    'load_folder_file': ('./temp/', 'best.pth.tar'),
    'numItersForTrainExamplesHistory': 20,
})
```

Pattern: mirror `framework/othello/main.py` but using Abalone classes.

### Framework Reference
- `framework/Coach.py` — self-play loop, MCTS, arena comparison
- `framework/MCTS.py` — Monte Carlo Tree Search
- `framework/othello/main.py` — reference training entry point

## Notes
- Coach expects: `game` (AbaloneGame), `nnet` (NNetWrapper instance), `args` dotdict
- MCTS uses `game.getCanonicalForm()`, `game.getGameEnded()`, `game.getValidMoves()` — all implemented in Phase 1
- `nnet.predict()` returns `(pi, v)` where `pi` is a numpy array of length 4026 — already correct
- No changes needed to Phase 1 or Phase 2 files for Phase 3
