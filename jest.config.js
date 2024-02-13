

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts', "jest-expect-message"],
  transform: {
    '^.+\\.ts?$': 'ts-jest',
  },
  moduleNameMapper: {
    "^d3-(.*)$": `<rootDir>/node_modules/d3-$1/dist/d3-$1.min.js`
  },
  reporters: ["default", "jest-html-reporters"]
};
