module.exports = {
  testRegex: "/testremotes/.*livetest\\.[jt]sx?$",
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
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
    "^.+\\.tsx?$": "esbuild-jest"
  },
};
