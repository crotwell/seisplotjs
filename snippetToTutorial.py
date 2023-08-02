#!/bin/env python3

import os.path
import re
import filecmp
from html.parser import HTMLParser
from bs4 import BeautifulSoup

StartSnip = re.compile('\s*// snip start (\w+)')
EndSnip = re.compile('\s*// snip end.*')
StartTag = re.compile('^<\w+.*>')
EndTag = re.compile('^</\w+>')
ComboStartEndTag = re.compile('^<\w+.*/>')
StartEndTag = re.compile('^<\w+.*>.*</\w+>$')

jsfilePattern = re.compile('^tutorial(\d+).js$')
#jsfilePattern = re.compile('^tutorial(3).js$')

def snippetReplace(dirpath, jsfilename, htmlfilename):
    print(f"jsfile={jsfilename}  htmlfile={htmlfilename}")
    # Read in the file
    filepath = os.path.join(dirpath, jsfilename)
    with open(filepath, 'r') as file :
        jsdata = file.readlines()

    filepath = os.path.join(dirpath, htmlfilename)
    with open(filepath, 'r') as file :
        soup = BeautifulSoup(file, 'html.parser')
    for c in soup.find_all('code'):
        if (c.get('class') is not None
              and "language-javascript" in c.get('class')
              and c.get('snippet') is not None
              and len(c.get('snippet')) != 0):
            snipname = c.get('snippet')
            print(f"code: {c.get('snippet')} {c.get('class')}")
            inSnip = False
            snipLines = []
            foundStart = False
            for line in jsdata:
                if not inSnip:
                    match = StartSnip.match(line)
                    if match:
                        if match.group(1) == snipname:
                            inSnip = True
                            foundStart = True
                            c.clear()
                            c.append("\n")
                else:
                    startmatch = StartSnip.match(line)
                    endmatch = EndSnip.match(line)
                    if startmatch or endmatch:
                        inSnip = False
                    else:
                        c.append(f"{line}")
                        snipLines.append(f"{line}")
            if not foundStart:
                raise Exception(f"Did not find a start snip for {snipname} jsfile={jsfilename}  htmlfile={htmlfilename}")
    with open(filepath+".mod.html", 'w', encoding='utf-8') as file:
        #file.write(redoIndent(soup.encode(formatter="html")))
        file.write(soup.prettify(formatter="html"))
        #file.write(redoIndent(str(soup)))
    os.rename(filepath, filepath+".orig")
    os.rename(filepath+".mod.html", filepath)
    if filecmp.cmp(filepath+".orig", filepath):
      print(f"{filepath} seems to have no changes ")
      os.unlink(filepath+".orig")


def redoIndent(text, spaces=2):
    level = 0
    indent = " "*spaces
    out = []
    #text = text.decode('utf-8')
    for line in text.split("\n"):
        trimLine = line.strip()
        if (ComboStartEndTag.match(trimLine) is not None
              or StartEndTag.match(trimLine) is not None):
            out.append(indent*level + trimLine)
        elif StartTag.match(trimLine) is not None:
            out.append(indent*level + trimLine)
            level = level+1
            print(f"start tag {level}  {line}")
        elif EndTag.match(trimLine) is not None:
            level = level-1
            out.append(indent*level + trimLine)
            print(f"end tag {level}  {line}")
        else:
            out.append(indent*level + trimLine)
    #return "\n".join(out).encode('utf-8')
    return "\n".join(out)


for dirpath, dirs, files in os.walk('docs/tutorial'):
    for filename in files:
        print(f"try {filename}")
        match = jsfilePattern.match(filename)
        if match:
            tutNum = match.group(1)
            jsfilename = filename

            htmlfilename = None
            if tutNum == '1':
                htmlfilename = 'index.html'
            else:
                htmlfilePattern = re.compile(f"^{tutNum}_\w+.html$")
                for hf in files:
                    htmlmatch = htmlfilePattern.match(hf)
                    if htmlmatch:
                        htmlfilename = hf
            if htmlfilename is None:
                print(f"cant find html to go with {jsfilename}")
            else:
                snippetReplace(dirpath, jsfilename, htmlfilename)
