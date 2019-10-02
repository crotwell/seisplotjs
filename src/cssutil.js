// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

export function insertCSS(cssText: string) {
  let head = document.head;
  if (head === null) {throw new Error("document.head is null");}
  let styleElement = document.createElement('style');
  styleElement.type = 'text/css';
  styleElement.appendChild(document.createTextNode(cssText));
  head.insertBefore(styleElement, head.firstChild);
}
