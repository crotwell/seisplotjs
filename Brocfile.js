var dist = require('broccoli-dist-es6-module');

module.exports = dist('src', {

  // the entry script, and module that becomes the global
  main: 'seisplot',

  // will become window.ic.ajax with the exports from `main`
  global: 'seisplot',

  // the prefix for named-amd modules
  packageName: 'seisplot',

  // global output only: naive shimming, when the id 'ember' is imported,
  // substitute with `window.Ember` instead
  shim: {
    'ember': 'Ember',
    'd3': 'd3'
  }
});
