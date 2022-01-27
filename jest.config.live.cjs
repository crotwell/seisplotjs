// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

var config = require('./jest.config.cjs')
config.testRegex = "livetest\\.js"

module.exports = config;
