import { JSDOM } from 'jsdom';

export function installDOM() {
  const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
  for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) {
    Object.defineProperty(globalThis, key, { configurable: true, value: (dom.window as any)[key] });
  }
  for (const key of ['requestAnimationFrame', 'cancelAnimationFrame'] as const) {
    Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key].bind(dom.window) });
  }
  const prototype = dom.window.Element.prototype as any;
  prototype.createEl = function(tag: string, info: any = {}, callback?: (element: HTMLElement) => void) {
    if (typeof info === 'function') { callback=info; info={}; }
    const element=dom.window.document.createElement(tag);
    if(typeof info==='string') element.className=info;
    else {
      if(info.cls) element.className=Array.isArray(info.cls)?info.cls.join(' '):info.cls;
      if(info.text!=null) element.textContent=String(info.text);
      for(const [key,value] of Object.entries(info.attr??{})) element.setAttribute(key,String(value));
    }
    this.appendChild(element); callback?.(element); return element;
  };
  prototype.createDiv=function(info?:any,callback?:any){return this.createEl('div',info,callback);};
  prototype.createSpan=function(info?:any,callback?:any){return this.createEl('span',info,callback);};
  prototype.empty=function(){this.replaceChildren();};
  prototype.addClass=function(...names:string[]){this.classList.add(...names);};
  prototype.removeClass=function(...names:string[]){this.classList.remove(...names);};
  prototype.setText=function(value:string){this.textContent=value;};
  prototype.toggleClass=function(name:string,enabled?:boolean){this.classList.toggle(name,enabled);};
  prototype.hasClass=function(name:string){return this.classList.contains(name);};
  prototype.setAttr=function(name:string,value:any){if(value==null)this.removeAttribute(name);else this.setAttribute(name,String(value));};
  prototype.setCssStyles=function(styles:any){Object.assign(this.style,styles);};
  prototype.setCssProps=function(styles:any){for(const [name,value]of Object.entries(styles))this.style.setProperty(name,String(value));};
  return dom;
}
