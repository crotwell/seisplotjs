
Just so I don't forget...

#To build:
npm run compile

# Test
npm test
npm run testremotes

#before publish:
update version in package.json
npm run version

git status
npm run prepublishOnly

npm login
npm publish

# tag, and github
git tag -a -m 'v3.2.8-SNAPSHOT' v3.2.8-SNAPSHOT
git push
# create release on github for tag and add standalone as binary

git switch main
git merge dev

# zenodo, draft new release
