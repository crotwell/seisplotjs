import * as pkg from "./package.json";
import babel from 'rollup-plugin-babel';
import flowEntry from 'rollup-plugin-flow-entry';
import json from '@rollup/plugin-json';

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
    '@babel/runtime/helpers/classCallCheck',
    '@babel/runtime/helpers/createClass',
    '@babel/runtime/helpers/typeof',
    '@babel/runtime/helpers/possibleConstructorReturn',
    '@babel/runtime/helpers/getPrototypeOf',
    '@babel/runtime/helpers/inherits',
    '@babel/runtime/helpers/slicedToArray',
    '@babel/runtime/helpers/wrapNativeSuper',
    '@babel/runtime/regenerator',
  ],
  plugins: [
    json(),
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
    '@babel/runtime/helpers/classCallCheck',
    '@babel/runtime/helpers/createClass',
    '@babel/runtime/helpers/typeof',
    '@babel/runtime/helpers/possibleConstructorReturn',
    '@babel/runtime/helpers/getPrototypeOf',
    '@babel/runtime/helpers/inherits',
    '@babel/runtime/helpers/slicedToArray',
    '@babel/runtime/helpers/wrapNativeSuper',
    '@babel/runtime/regenerator',
  ],
  plugins: [
    json(),
    flowEntry(),
    babel({
      exclude: 'node_modules/**',
      runtimeHelpers: true,
    })
  ]
  }
];
