import os
import sys

import numpy as np
from tqdm import tqdm

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "framework"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from NeuralNet import NeuralNet
from utils import dotdict, AverageMeter

import torch
import torch.optim as optim

from .AbaloneNNet import AbaloneNNet

# Import CELLS from AbaloneConstants (sibling package)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from AbaloneConstants import CELLS

# Precompute valid-cell mask once — (9, 9) float32
_VALID_CELL_MASK = np.zeros((9, 9), dtype=np.float32)
for _q, _r in CELLS:
    _VALID_CELL_MASK[_q + 4, _r + 4] = 1.0

args = dotdict({
    "lr": 0.001,
    "dropout": 0.3,
    "epochs": 10,
    "batch_size": 64,
    "cuda": torch.cuda.is_available(),
    "num_channels": 128,
})


class NNetWrapper(NeuralNet):
    def __init__(self, game) -> None:
        self.nnet = AbaloneNNet(args)
        self.action_size = game.getActionSize()

        if args.cuda:
            self.nnet.cuda()

    def _board_to_tensor(self, board: np.ndarray) -> np.ndarray:
        """Convert 9×9 canonical board to (3, 9, 9) float32 array."""
        ch0 = (board == 1).astype(np.float32)
        ch1 = (board == -1).astype(np.float32)
        ch2 = _VALID_CELL_MASK
        return np.stack([ch0, ch1, ch2])  # (3, 9, 9)

    def train(self, examples) -> None:
        optimizer = optim.Adam(self.nnet.parameters(), lr=args.lr)

        for epoch in range(args.epochs):
            print(f"EPOCH ::: {epoch + 1}")
            self.nnet.train()
            pi_losses = AverageMeter()
            v_losses = AverageMeter()

            batch_count = int(len(examples) / args.batch_size)

            t = tqdm(range(batch_count), desc="Training Net")
            for _ in t:
                sample_ids = np.random.randint(len(examples), size=args.batch_size)
                boards, pis, vs = list(zip(*[examples[i] for i in sample_ids]))

                boards = np.array([self._board_to_tensor(b) for b in boards], dtype=np.float32)
                boards = torch.FloatTensor(boards)
                target_pis = torch.FloatTensor(np.array(pis))
                target_vs = torch.FloatTensor(np.array(vs).astype(np.float32))

                if args.cuda:
                    boards = boards.contiguous().cuda()
                    target_pis = target_pis.contiguous().cuda()
                    target_vs = target_vs.contiguous().cuda()

                out_pi, out_v = self.nnet(boards)
                l_pi = self.loss_pi(target_pis, out_pi)
                l_v = self.loss_v(target_vs, out_v)
                total_loss = l_pi + l_v

                pi_losses.update(l_pi.item(), boards.size(0))
                v_losses.update(l_v.item(), boards.size(0))
                t.set_postfix(Loss_pi=pi_losses, Loss_v=v_losses)

                optimizer.zero_grad()
                total_loss.backward()
                optimizer.step()

    def predict(self, board: np.ndarray):
        tensor = self._board_to_tensor(board)
        tensor = torch.FloatTensor(tensor).unsqueeze(0)  # (1, 3, 9, 9)
        if args.cuda:
            tensor = tensor.contiguous().cuda()

        self.nnet.eval()
        with torch.no_grad():
            pi, v = self.nnet(tensor)

        return torch.exp(pi).data.cpu().numpy()[0], v.data.cpu().numpy()[0]

    def loss_pi(self, targets: torch.Tensor, outputs: torch.Tensor) -> torch.Tensor:
        return -torch.sum(targets * outputs) / targets.size(0)

    def loss_v(self, targets: torch.Tensor, outputs: torch.Tensor) -> torch.Tensor:
        return torch.sum((targets - outputs.view(-1)) ** 2) / targets.size(0)

    def save_checkpoint(self, folder: str = "checkpoint", filename: str = "checkpoint.pth.tar") -> None:
        filepath = os.path.join(folder, filename)
        if not os.path.exists(folder):
            print(f"Checkpoint Directory does not exist! Making directory {folder}")
            os.mkdir(folder)
        else:
            print("Checkpoint Directory exists!")
        torch.save({"state_dict": self.nnet.state_dict()}, filepath)

    def load_checkpoint(self, folder: str = "checkpoint", filename: str = "checkpoint.pth.tar") -> None:
        filepath = os.path.join(folder, filename)
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"No model in path {filepath}")
        map_location = None if args.cuda else "cpu"
        checkpoint = torch.load(filepath, map_location=map_location)
        self.nnet.load_state_dict(checkpoint["state_dict"])
