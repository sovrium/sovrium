/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


const DOCS_PROSE_PATCH = `
.prose :where(p,li){color:var(--tw-prose-body);}
.prose :where(a):not(:where([data-component] *)){color:var(--color-warmth, #c08457);text-decoration:underline;text-underline-offset:2px;}
.prose :where(a):not(:where([data-component] *)):hover{color:var(--color-warmth-border, #8a5a3a);}
.prose :where(:not(pre)>code)::before,.prose :where(:not(pre)>code)::after{content:none;}
.prose :where(:not(pre)>code){color:var(--color-warmth, #c08457);background:#f5f0eb;border:1px solid #e5ded5;border-radius:.375rem;padding:.1rem .4rem;font-weight:500;}
.dark .prose :where(:not(pre)>code){background:#171717;border-color:#262626;}
.prose pre.shiki{background:#0d0d0d;color:#e1e4e8;border:1px solid #262626;border-radius:.75rem;padding:1rem 1.25rem;overflow-x:auto;}
.prose pre.shiki code{background:none;border:0;padding:0;color:inherit;font-weight:400;}
.prose .md-callout,.prose [data-component="alert"]{border:1px solid #e5ded5;border-left:3px solid var(--color-warmth-border, #8a5a3a);background:#f5f0eb;border-radius:0 .5rem .5rem 0;padding:.85rem 1rem;margin:0 0 1.5rem;color:#3f3a34;}
.dark .prose .md-callout,.dark .prose [data-component="alert"]{border-color:#262626;background:#171717;color:#d4d4d4;}
.prose .md-callout p,.prose [data-component="alert"] p{color:inherit;}
.prose .md-callout :first-child,.prose [data-component="alert"] :first-child{margin-top:0;}
.prose .md-callout :last-child,.prose [data-component="alert"] :last-child{margin-bottom:0;}
.prose :where(h1,h2,h3,h4,h5,h6){scroll-margin-top:5rem;}
.prose [data-component="docs-article-header"] ol,.prose [data-component="docs-article-header"] li{margin:0;padding:0;}
`

export const DOCS_PROSE_PATCH_HTML = { __html: DOCS_PROSE_PATCH }

const CODE_COPY_SCRIPT = `(function(){
"use strict";
function enhance(){
var blocks=document.querySelectorAll("pre.shiki:not([data-copy-ready])");
for(var i=0;i<blocks.length;i++){
var pre=blocks[i];
pre.setAttribute("data-copy-ready","");
pre.classList.add("sv-code-copy-pre");
var btn=document.createElement("button");
btn.type="button";
btn.className="sv-code-copy-btn";
btn.setAttribute("aria-label","Copy code");
btn.textContent="Copy";
btn.addEventListener("click",(function(p,b){return function(){
var code=p.querySelector("code");
var text=(code?code.innerText:p.innerText)||"";
var done=function(){var o=b.textContent;b.textContent="Copied";setTimeout(function(){b.textContent=o;},1500);};
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(done).catch(function(){});}
else{try{var ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);done();}catch(e){}}
};})(pre,btn));
pre.appendChild(btn);
}
}
if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",enhance);}else{enhance();}
})();`

const CODE_COPY_STYLE = `
pre.sv-code-copy-pre{position:relative;}
.sv-code-copy-btn{position:absolute;top:.5rem;right:.5rem;padding:.2rem .55rem;font-size:.7rem;line-height:1;border:1px solid var(--color-border-strong,#262626);border-radius:.375rem;background:var(--color-background-subtle,#171717);color:var(--color-foreground-muted,#d4d4d4);cursor:pointer;}
.sv-code-copy-btn:hover{color:var(--color-foreground,#fff);}
`

export const CODE_COPY_STYLE_HTML = { __html: CODE_COPY_STYLE }
export const CODE_COPY_SCRIPT_HTML = { __html: CODE_COPY_SCRIPT }

const TOC_SCROLLSPY_STYLE = `
.sv-toc-link[data-active="true"]{border-left-color:var(--color-warmth-border, #8a5a3a);color:var(--color-foreground, #fafafa);font-weight:500;}
`

const TOC_SCROLLSPY_SCRIPT = `(function(){
"use strict";
function init(){
var nav=document.querySelector('[data-component="markdown-toc"]:not([data-toc-spy-ready])');
if(!nav){return;}
nav.setAttribute("data-toc-spy-ready","");
var links=nav.querySelectorAll("[data-toc-link]");
if(!links.length||typeof IntersectionObserver==="undefined"){return;}
var linkById={};
var ids=[];
for(var i=0;i<links.length;i++){var id=links[i].getAttribute("data-toc-link");if(id){linkById[id]=links[i];ids.push(id);}}
var visible={};
function setActive(id){for(var j=0;j<ids.length;j++){var l=linkById[ids[j]];if(l){if(ids[j]===id){l.setAttribute("data-active","true");}else{l.removeAttribute("data-active");}}}}
var obs=new IntersectionObserver(function(entries){
for(var k=0;k<entries.length;k++){var e=entries[k];var hid=e.target.id;if(e.isIntersecting){visible[hid]=true;}else{delete visible[hid];}}
var firstVisible=null;for(var m=0;m<ids.length;m++){if(visible[ids[m]]){firstVisible=ids[m];break;}}
if(firstVisible){setActive(firstVisible);}
},{rootMargin:"-80px 0px -70% 0px",threshold:0});
for(var n=0;n<ids.length;n++){var h=document.getElementById(ids[n]);if(h){obs.observe(h);}}
}
if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",init);}else{init();}
})();`

export const TOC_SCROLLSPY_STYLE_HTML = { __html: TOC_SCROLLSPY_STYLE }
export const TOC_SCROLLSPY_SCRIPT_HTML = { __html: TOC_SCROLLSPY_SCRIPT }

const COPY_MARKDOWN_SCRIPT = `(function(){
"use strict";
function enhance(){
var btns=document.querySelectorAll("[data-copy-markdown]:not([data-copy-ready])");
for(var i=0;i<btns.length;i++){
(function(btn){
btn.setAttribute("data-copy-ready","");
var url=btn.getAttribute("data-copy-markdown-url");
var cached=null;
if(url){fetch(url).then(function(r){return r.text();}).then(function(t){cached=t;}).catch(function(){});}
function write(text){
var restore=btn.textContent;
var flip=function(){btn.textContent="Copied";setTimeout(function(){btn.textContent=restore;},1500);};
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(flip).catch(function(){});}
else{try{var ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);flip();}catch(e){}}
}
btn.addEventListener("click",function(){
if(cached!==null){write(cached);}
else if(url){fetch(url).then(function(r){return r.text();}).then(write).catch(function(){});}
});
})(btns[i]);
}
}
if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",enhance);}else{enhance();}
})();`

export const COPY_MARKDOWN_SCRIPT_HTML = { __html: COPY_MARKDOWN_SCRIPT }
