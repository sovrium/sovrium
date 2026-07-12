/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { CollectionNavEntry } from '@/presentation/rendering/content-dir-lister'

export type TabId = 'data-logic' | 'platform' | 'operations'

export const TAB_ORDER: readonly TabId[] = ['data-logic', 'platform', 'operations']

const TAB_FOR_SECTION: Readonly<Record<string, TabId>> = {
  'get-started': 'data-logic',
  tables: 'data-logic',
  records: 'data-logic',
  pages: 'data-logic',
  forms: 'data-logic',
  automations: 'data-logic',
  ai: 'data-logic',
  search: 'data-logic',
  storage: 'data-logic',
  'app-schema': 'platform',
  auth: 'platform',
  operations: 'operations',
  references: 'operations',
  project: 'operations',
}

export const TAB_LABELS: Readonly<Record<'en' | 'fr', Readonly<Record<TabId, string>>>> = {
  en: { 'data-logic': 'Data & Logic', platform: 'Platform', operations: 'Operations' },
  fr: { 'data-logic': 'Données & Logique', platform: 'Plateforme', operations: 'Opérations' },
}

export const deriveLang = (entries: readonly CollectionNavEntry[]): 'en' | 'fr' =>
  entries.some((entry) => entry.href.startsWith('/fr/')) ? 'fr' : 'en'

export const tabOfSection = (name: string | undefined): TabId =>
  (name === undefined ? undefined : TAB_FOR_SECTION[name]) ?? 'data-logic'

export const sectionHasTab = (name: string | undefined): boolean =>
  name !== undefined && TAB_FOR_SECTION[name] !== undefined

const SIDEBAR_TABS_STYLE = `
[data-docs-tab-btn]{border-bottom:2px solid transparent;margin-bottom:-1px;}
[data-docs-tab-btn][aria-selected="true"]{color:var(--color-foreground, #fafafa);border-bottom-color:var(--color-warmth-border, #8a5a3a);}
`

const SIDEBAR_TABS_SCRIPT = `(function(){
"use strict";
function init(){
var list=document.querySelector('[data-docs-tabs]:not([data-docs-tabs-ready])');
if(!list){return;}
list.setAttribute("data-docs-tabs-ready","");
var btns=[].slice.call(list.querySelectorAll("[data-docs-tab-btn]"));
if(!btns.length){return;}
function activate(id,focus){
for(var i=0;i<btns.length;i++){
var on=btns[i].getAttribute("data-docs-tab-btn")===id;
btns[i].setAttribute("aria-selected",on?"true":"false");
btns[i].tabIndex=on?0:-1;
if(on&&focus){btns[i].focus();}
}
var panels=document.querySelectorAll("[data-docs-tab-panel]");
for(var j=0;j<panels.length;j++){
if(panels[j].getAttribute("data-docs-tab-panel")===id){panels[j].hidden=false;}else{panels[j].hidden=true;}
}
}
for(var k=0;k<btns.length;k++){
(function(idx){
btns[idx].addEventListener("click",function(){activate(btns[idx].getAttribute("data-docs-tab-btn"),false);});
btns[idx].addEventListener("keydown",function(e){
if(e.key==="ArrowRight"||e.key==="ArrowDown"){e.preventDefault();activate(btns[(idx+1)%btns.length].getAttribute("data-docs-tab-btn"),true);}
else if(e.key==="ArrowLeft"||e.key==="ArrowUp"){e.preventDefault();activate(btns[(idx-1+btns.length)%btns.length].getAttribute("data-docs-tab-btn"),true);}
});
})(k);
}
}
if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",init);}else{init();}
})();`

export const TABS_STYLE_HTML = { __html: SIDEBAR_TABS_STYLE }
export const TABS_SCRIPT_HTML = { __html: SIDEBAR_TABS_SCRIPT }
