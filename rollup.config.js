import * as meta from "./package.json";
import babel from 'rollup-plugin-babel';

export default [{
  input: 'src/index.js',
  output: [
    {
      file: `dist/seisplot-${meta.version}-umd.js`,
      name: "seisplotjs",
      format: 'umd'
    },
    {
      file: `dist/seisplot-${meta.version}-esm.js`,
      format: 'esm'
    }
  ],
  plugins: [
    babel({
      exclude: 'node_modules/**',
      runtimeHelpers: true
    })
  ]
}];
