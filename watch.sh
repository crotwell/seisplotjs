#!/bin/zsh

# compile once to start
WEBPID=0
SKIPTEST=true
COMPILE=compile
#COMPILE=standalone

function doit {
  (npm run $COMPILE ) && ($SKIPTEST || npm test) && \
  npm run servedocs &
  WEBPID=$!

  date
  echo "OK $WEBPID"
}

function cleanup {
  kill $WEBPID
  echo "kill $WEBPID"
  echo "cleanup"
}

trap cleanup INT

doit

if [ $WEBPID -ne 0 ]; then
  # recompile on file change within 1 seconds, except version.ts
  fswatch -o -l 1 --exclude version.ts src package.json tsconfig.json | while read stuff; do
    echo $stuff
    echo "Restarting..."
    kill $WEBPID
    sleep 1
    doit
    echo "OK $WEBPID"
  done
fi
