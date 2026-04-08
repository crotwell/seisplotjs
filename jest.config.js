/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  testMatch: ["<rootDir>/test/**/*.ts", "!**/jestRatioMatchers.ts", "!**/sacfile.ts"],
  preset: "ts-jest",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: [
    "<rootDir>/jest.setup.ts",
    'jest-extended/all'
  ],
  transform: {
    "^.+\\.ts?$": "ts-jest",
  },
  moduleNameMapper: {
    "^d3-(.*)$": `<rootDir>/node_modules/d3-$1/dist/d3-$1.min.js`,
  },
  reporters: ["default"],
};
