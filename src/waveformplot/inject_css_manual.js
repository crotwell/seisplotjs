

import * as chooser_css from './chooser_css.js';
import * as seismograph_css from './seismograph_css.js';
import * as pikaday_css from './pikaday_css.js';

function insertCSS(cssText) {
  let head = document.head;
  let styleElement = document.createElement('style');
  styleElement.type = 'text/css';
  styleElement.appendChild(document.createTextNode(cssText));
  head.insertBefore(styleElement, head.firstChild);
}

insertCSS(chooser_css.css);
insertCSS(seismograph_css.css);
insertCSS(pikaday_css.css);
