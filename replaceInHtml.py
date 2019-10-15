#!/bin/env python3

import os.path

replaceItems = {
  "<h3 class='mb0 no-anchor'>seisplotjs.":"<h3 class='mb0 no-anchor'><a href=\"index.html\">seisplotjs</a>.",
  "https://git@github.com/:crotwell": "https://github.com/crotwell"
}

for dirpath, dirs, files in os.walk('docs/api'):
    for filename in files:
        if filename.endswith('.html') and not filename is "index.html":
            # Read in the file
            filepath = os.path.join(dirpath, filename)
            with open(filepath, 'r') as file :
              filedata = file.read()

            # Replace the target string
            for k, v in replaceItems.items():
                filedata = filedata.replace(k, v)

            # Write the file out again
            with open(filepath, 'w') as file:
              file.write(filedata)
