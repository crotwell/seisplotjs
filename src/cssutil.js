// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

/**
 * Inserts text as css into the head of an html document. No checking
 * as to validity of the css is done, just inserts a style
 * element at the beginning of the head.
 * 
 * @param  cssText textual css for insertion
 * @returns the style html element inserted
 */
export function insertCSS(cssText: string): HTMLElement {
  let head = document.head;
  if (head === null) {throw new Error("document.head is null");}
  let styleElement = document.createElement('style');
  styleElement.type = 'text/css';
  styleElement.appendChild(document.createTextNode(cssText));
  head.insertBefore(styleElement, head.firstChild);
  return styleElement;
}
