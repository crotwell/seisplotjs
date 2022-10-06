
// modify from https://souporserious.com/bundling-typescript-with-esbuild-for-npm/

//const { build } = require('esbuild')
//const { Generator } = require('npm-dts')
//const { dependencies, peerDependencies } = require('./package.json')

import {build} from 'esbuild';
//import {Generator} from 'npm-dts'
import * as fs from 'fs';
const loadJSON = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const mypackage = loadJSON('./package.json');
const dependencies = mypackage.dependencies;
//import {dependencies, peerDependencies } from './package.json'  assert { type: "json" };

const entryFile = 'src/index.ts'
const shared = {
  entryPoints: [entryFile],
  bundle: true,
  external: Object.keys(dependencies),
}

build({
  ...shared,
  outfile: 'dist/index.js',
})

build({
  ...shared,
  outfile: 'dist/index.esm.js',
  format: 'esm',
})

// new Generator({
//   entry: entryFile,
//   output: 'dist/index.d.ts',
// }).generate()
