import * as pkg from "./package.json";
import babel from 'rollup-plugin-babel';
import flowEntry from 'rollup-plugin-flow-entry';

export default [{
  input: 'src/index.js',
  output: [
    {
      file: pkg.main,
      name: "seisplotjs",
      format: 'umd',
      sourcemap: true,
    }
  ],
  external: [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ],
  plugins: [
    flowEntry(),
    babel({
      exclude: 'node_modules/**',
      runtimeHelpers: true,
    })
  ]
},{
  input: 'src/index.js',
  preserveModules: true,
  output: [
    {
      dir: "dist/module",
      //file: pkg.module,
      format: 'esm',
      sourcemap: true,
    }
  ],
  external: [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ],
  plugins: [
    flowEntry(),
    babel({
      exclude: 'node_modules/**',
      runtimeHelpers: true,
    })
  ]
  }
];
