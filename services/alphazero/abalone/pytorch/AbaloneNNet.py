import torch
import torch.nn as nn
import torch.nn.functional as F

BOARD_SIZE = 9
ACTION_SIZE = 4026
IN_CHANNELS = 3


class ResidualBlock(nn.Module):
    def __init__(self, channels: int) -> None:
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, 3, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, 3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(channels)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        residual = x
        out = F.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        return F.relu(out + residual)


class AbaloneNNet(nn.Module):
    def __init__(self, args) -> None:
        super().__init__()
        ch = args.num_channels

        self.conv_in = nn.Conv2d(IN_CHANNELS, ch, 3, padding=1, bias=False)
        self.bn_in = nn.BatchNorm2d(ch)

        self.res_blocks = nn.Sequential(*[ResidualBlock(ch) for _ in range(5)])

        flat = ch * BOARD_SIZE * BOARD_SIZE  # 128 * 9 * 9 = 10368

        # Policy head
        self.pi_fc1 = nn.Linear(flat, 512)
        self.pi_bn1 = nn.BatchNorm1d(512)
        self.pi_fc2 = nn.Linear(512, ACTION_SIZE)

        # Value head
        self.v_fc1 = nn.Linear(flat, 256)
        self.v_bn1 = nn.BatchNorm1d(256)
        self.v_fc2 = nn.Linear(256, 1)

        self.dropout = args.dropout

    def forward(self, s: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        # s: (batch, 3, 9, 9)
        s = F.relu(self.bn_in(self.conv_in(s)))
        s = self.res_blocks(s)
        s = s.view(s.size(0), -1)

        pi = F.dropout(F.relu(self.pi_bn1(self.pi_fc1(s))), p=self.dropout, training=self.training)
        pi = F.log_softmax(self.pi_fc2(pi), dim=1)

        v = F.dropout(F.relu(self.v_bn1(self.v_fc1(s))), p=self.dropout, training=self.training)
        v = torch.tanh(self.v_fc2(v))

        return pi, v
