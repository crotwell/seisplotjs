import * as pkg from "./package.json";
import babel from '@rollup/plugin-babel';
import json from '@rollup/plugin-json';
import ts from "rollup-plugin-ts";

export default [{
  input: 'src/index.ts',
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
    ts(),
    babel({
      exclude: 'node_modules/**',
      babelHelpers: 'runtime',
    })
  ]
},{
  input: 'src/index.ts',
  //preserveModules: true,
  output: [
    {
      dir: "dist/module",
      //file: pkg.module,
      format: 'es',
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
    ts(),
    json(),
    babel({
      exclude: 'node_modules/**',
      babelHelpers: 'runtime',
    })
  ]
  }
];
