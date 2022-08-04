#!/bin/zsh

# compile once to start
npm run compile && ./copyToDocs.sh

# recompile on file change within 1 seconds, except version.ts
fswatch -o -l 1 --exclude version.ts src | while read stuff; do
  npm run compile && npm run tsc
done
