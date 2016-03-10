#!/bin/sh

MODE=$1
echo "Restart: MODE=$MODE"
DIR=$(readlink -m "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )""/.." )
cd $DIR

./bin/stop.sh $MODE
./bin/start.sh $MODE
