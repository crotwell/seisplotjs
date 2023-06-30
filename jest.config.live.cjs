
const esModules = [
'd3-array',
'd3-scale',
'd3-axis',
'd3-selection',
'd3-color',
'd3-shape',
'd3-dispatch',
'd3-time',
'd3-drag',
'd3-time-format',
'd3-ease',
'd3-timer',
'd3-format',
'd3-transition',
'd3-interpolate',
'd3-zoom',
'd3-path',
'internmap',
 ].join('|');

module.exports = {
  testMatch: ['<rootDir>/testremotes/**/*_livetest.ts'],
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts', "jest-expect-message"],
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  "transform": {
    "^.+\\.[jt]sx?$": [
      "esbuild-jest"
    ]
  },
  "transformIgnorePatterns": [
      `node_modules/(?!${esModules})`
    ],
  "testTimeout": 15000,
};
