#!/bin/zsh

# compile once to start
WEBPID=0


function doit {
  (npm run compile || npm run tsc) && npm run test && \
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


# compile once to start
npm run compile || npm run tsc
date
echo "OK"

# recompile on file change within 1 seconds, except version.ts
fswatch -o -l 1 --exclude version.ts --exclude handlebarsimport.ts src | while read stuff; do
  echo $stuff
  npm run compile && npm run test
  date
  echo "OK"
done
