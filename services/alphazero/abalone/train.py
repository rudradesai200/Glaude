import logging
import sys
import os

import coloredlogs

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from abalone.AbaloneGame import AbaloneGame
from abalone.pytorch.NNet import NNetWrapper as nn
from framework.Coach import Coach
from framework.utils import dotdict

log = logging.getLogger(__name__)

coloredlogs.install(level="INFO")

args = dotdict({
    "numIters": 50,
    "numEps": 50,
    "tempThreshold": 15,
    "updateThreshold": 0.6,
    "maxlenOfQueue": 200000,
    "numMCTSSims": 15,
    "arenaCompare": 20,
    "cpuct": 1,
    "checkpoint": "./checkpoints/",
    "load_model": False,
    "load_folder_file": ("./temp/", "temp.pth.tar"),
    "numItersForTrainExamplesHistory": 20,
})


def main():
    log.info("Loading %s...", AbaloneGame.__name__)
    g = AbaloneGame()

    log.info("Loading %s...", nn.__name__)
    nnet = nn(g)

    if args.load_model:
        log.info(
            'Loading checkpoint "%s/%s"...',
            args.load_folder_file[0],
            args.load_folder_file[1],
        )
        nnet.load_checkpoint(args.load_folder_file[0], args.load_folder_file[1])
    else:
        log.warning("Not loading a checkpoint!")

    log.info("Loading the Coach...")
    c = Coach(g, nnet, args)

    if args.load_model:
        log.info("Loading 'trainExamples' from file...")
        c.loadTrainExamples()

    log.info("Starting the learning process!")
    c.learn()


if __name__ == "__main__":
    main()
