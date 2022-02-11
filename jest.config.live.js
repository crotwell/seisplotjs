/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  testRegex: "(/testremotes/.*|(\\.|/)(livetest))\\.[jt]sx?$",
  preset: 'ts-jest',
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
};
