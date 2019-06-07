

import {chooser_css,} from './chooser_css.js';
import {seismograph_css,} from './seismograph_css.js';
import {pikaday_css,} from './pikaday_css.js';

function insertCSS(cssText) {
  let head = document.head;
  let styleElement = document.createElement('style');
  styleElement.type = 'text/css';
  styleElement.appendChild(document.createTextNode(cssText));
  head.insertBefore(styleElement, head.firstChild);
}

insertCSS(chooser_css);
insertCSS(seismograph_css);
insertCSS(pikaday_css);
