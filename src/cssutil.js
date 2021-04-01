// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

export const AUTO_CLASSED = "autoseisplotjs";

/**
 * Inserts text as css into the head of an html document. No checking
 * as to validity of the css is done, just inserts a style
 * element at the beginning of the head.
 *
 * @param  cssText textual css for insertion
 * @returns the style html element inserted
 */
export function insertCSS(cssText: string, id: string): HTMLElement {
  console.log("insertCSS")
  let head = document.head;
  if (head === null) {throw new Error("document.head is null");}
  if (id) {
    for (let c of head.children) {
      // only remove if a <style> element, classed with autoseisplotjs and same id within head
      if (c.localName === "style" && c.id ===id && c.classList.contains(AUTO_CLASSED)) {
        c.parentNode.removeChild(c);
        break;
      }
    }
  }
  let styleElement = document.createElement('style');
  if (id) { styleElement.id = id; }
  styleElement.type = 'text/css';
  styleElement.classList.add(AUTO_CLASSED);
  styleElement.appendChild(document.createTextNode(cssText));
  head.insertBefore(styleElement, head.firstChild);
  return styleElement;
}
