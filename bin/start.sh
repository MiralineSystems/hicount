#!/bin/sh

MODE=$1
echo "Start: MODE=$MODE"
DIR=$(readlink -m "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )""/.." )
echo "Starting in $DIR"
cd $DIR
LOG=./var/log/out.log

export NODE_ENV=production

if [ "$MODE" != "fast" ]; then
./bin/compress.sh
fi

touch $LOG
export NODE_ENV=production
nodejs app.js >>$LOG 2>>$LOG &

if [ "$MODE" != "fast" ]; then
tail -n 50 -f ./var/log/out.log
fi
