#!/bin/zsh

# compile once to start
npm run compile && ./copyToDocs.sh && npm run tsc

# recompile on file change within 1 seconds, except version.ts
fswatch -o -l 1 --exclude version.ts --exclude handlebarsimport.ts src | while read stuff; do
  echo $stuff
  npm run compile && npm run tsc && npm run test 
  echo "OK"
done
