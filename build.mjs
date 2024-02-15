// modify from https://souporserious.com/bundling-typescript-with-esbuild-for-npm/

//const { build } = require('esbuild')
//const { Generator } = require('npm-dts')
//const { dependencies, peerDependencies } = require('./package.json')

import { build } from "esbuild";
//import {Generator} from 'npm-dts'
import * as fs from "fs";
const loadJSON = (path) =>
  JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const mypackage = loadJSON("./package.json");
const dependencies = mypackage.dependencies;
//import {dependencies, peerDependencies } from './package.json'  assert { type: "json" };

const entryFile = "src/index.ts";
const entryPoints = [entryFile];
const shared = {
  entryPoints: [entryFile],
  bundle: true,
  external: Object.keys(dependencies),
  define: { global: "window" },
};

build({
  ...shared,
  outfile: "dist/index.js",
});

build({
  ...shared,
  outfile: "dist/index.mjs",
  format: "esm",
});

// build separate files for each module for easier use of part of sp and
// help with tree shaking???
const nonEntryPoints = [
  "handlebarshelpers",
  "leaflet_css",
  "oregondsputil",
  "scale",
  "seismogramsegment",
  "seismographconfig",
  "seismographconfigeditor",
  "sorting",
  "spelement",
  "util",
  "vector",
  "version",
].map((f) => `${f}.ts`);
const srcFiles = fs
  .readdirSync("./src")
  .filter((k) => k.endsWith(".ts"))
  .filter((k) => !k.startsWith("index"))
  .filter((k) => !nonEntryPoints.includes(k))
  .map((f) => `src/${f}`);
console.log(`src files: ${srcFiles}`);
build({
  entryPoints: srcFiles,
  bundle: true,
  platform: "neutral",
  external: Object.keys(dependencies),
  outdir: "dist/esm",
  format: "esm",
});

// without leaflet for node (leaflet requires window global)
const nodeEntryFile = "src/index_node.ts";
const nodeDependencies = Object.keys(dependencies).filter(
  (k) => k !== "leaflet" && k !== "leafletutil",
);
console.log(`deps: ${nodeDependencies}`);
build({
  entryPoints: [nodeEntryFile],
  bundle: true,
  external: nodeDependencies,
  outfile: "dist/index_node.mjs",
  format: "esm",
});

// new Generator({
//   entry: entryFile,
//   output: 'dist/index.d.ts',
// }).generate()
