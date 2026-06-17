/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { DocsPrevNext } from '@/presentation/ui/pages/markdown/DocsPrevNext'
import { DocsSidebarNav } from '@/presentation/ui/pages/markdown/DocsSidebarNav'
import type { ResolvedMarkdownPage } from '@/presentation/rendering/markdown-page-resolver'

const ARTICLE_LAYOUT_CLASSES: Readonly<
  Record<Exclude<ResolvedMarkdownPage['layout'], 'none'>, string>
> = {
  prose: 'mx-auto max-w-3xl px-4 py-12',
  docs: 'prose dark:prose-invert max-w-none min-w-0 flex-1 px-8 py-12',
  full: 'w-full px-4 py-12',
} as const

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
`

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
.sv-code-copy-btn{position:absolute;top:.5rem;right:.5rem;padding:.2rem .55rem;font-size:.7rem;line-height:1;border:1px solid #262626;border-radius:.375rem;background:#171717;color:#d4d4d4;cursor:pointer;}
.sv-code-copy-btn:hover{color:#fff;}
`

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

interface MarkdownArticleProps {
  readonly markdown: ResolvedMarkdownPage
}

const buildHtmlContainer = (html: string): { readonly __html: string } => ({ __html: html })

const tocIndentClass = (level: number): string => {
  if (level <= 2) return ''
  if (level === 3) return 'pl-3'
  return 'pl-6'
}

const renderToc = (markdown: ResolvedMarkdownPage): Readonly<ReactElement> | undefined => {
  if (markdown.tocHeadings === undefined || markdown.tocHeadings.length === 0) return undefined
  const sidebar = markdown.tocPosition === 'sidebar'
  return (
    <nav
      data-component="markdown-toc"
      data-position={markdown.tocPosition ?? 'top'}
      aria-label="Table of contents"
      className={
        sidebar
          ? 'sticky top-20 hidden max-h-[calc(100dvh-6rem)] w-56 shrink-0 self-start overflow-y-auto py-12 pr-4 text-sm xl:block'
          : 'mb-6 text-sm'
      }
    >
      <p className="mb-3 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
        On this page
      </p>
      <ol className="space-y-2 border-l border-neutral-800">
        {markdown.tocHeadings.map((heading) => (
          <li
            key={heading.id}
            data-toc-level={heading.level}
            className={tocIndentClass(heading.level)}
          >
            <a
              href={`#${heading.id}`}
              data-toc-link={heading.id}
              className="sv-toc-link hover:border-warmth-border -ml-px block border-l border-transparent pl-3 text-neutral-400 transition-colors duration-150 hover:text-neutral-50"
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

const deriveHomeHref = (href: string): string => {
  const match = href.match(/^\/([^/]+)\//)
  return match ? `/${match[1]}/` : '/'
}

const renderDocsArticleHeader = (
  markdown: ResolvedMarkdownPage
): Readonly<ReactElement> | undefined => {
  const nav = markdown.collectionNav
  if (nav === undefined) return undefined
  const current = nav.sidebar.find((entry) => entry.isCurrent)
  if (current === undefined) return undefined

  const homeHref = deriveHomeHref(current.href)
  const sectionLabel = current.groupLabel
  const pageLabel = current.label

  const crumbLinkClass =
    'text-foreground-subtle hover:text-foreground transition-colors duration-150 no-underline'

  return (
    <div
      data-component="docs-article-header"
      className="mb-6 flex items-center justify-between gap-4"
    >
      <nav
        aria-label="Breadcrumb"
        className="min-w-0 text-xs"
      >
        <ol className="text-foreground-subtle flex flex-wrap items-center gap-1.5">
          <li>
            <a
              href={homeHref}
              className={crumbLinkClass}
            >
              Home
            </a>
          </li>
          {sectionLabel !== undefined && (
            <>
              <li aria-hidden="true">/</li>
              <li className="text-foreground-muted">{sectionLabel}</li>
            </>
          )}
          <li aria-hidden="true">/</li>
          <li
            aria-current="page"
            className="text-foreground truncate"
          >
            {pageLabel}
          </li>
        </ol>
      </nav>
      {}
      <a
        href="/llms-full.txt"
        className="text-foreground-subtle hover:text-foreground inline-flex shrink-0 items-center gap-1.5 text-xs no-underline transition-colors duration-150"
        aria-label="View documentation as Markdown"
      >
        View as Markdown
      </a>
    </div>
  )
}

function renderRawMarkdown(markdown: ResolvedMarkdownPage): Readonly<ReactElement> {
  return (
    <div
      data-component="markdown"
      data-layout="none"
      dangerouslySetInnerHTML={buildHtmlContainer(markdown.html)}
    />
  )
}

function renderArticle(
  markdown: ResolvedMarkdownPage,
  inlineToc: Readonly<ReactElement> | undefined,
  layout: Exclude<ResolvedMarkdownPage['layout'], 'none'>
): Readonly<ReactElement> {
  const wrapperClass = ARTICLE_LAYOUT_CLASSES[layout]
  const docsHeader = layout === 'docs' ? renderDocsArticleHeader(markdown) : undefined
  return (
    <article
      data-component="markdown"
      data-layout={layout}
      className={wrapperClass}
    >
      {inlineToc}
      {docsHeader}
      {}
      <div dangerouslySetInnerHTML={buildHtmlContainer(markdown.html)} />
      {layout === 'docs' && markdown.collectionNav && (
        <DocsPrevNext
          previous={markdown.collectionNav.previous}
          next={markdown.collectionNav.next}
        />
      )}
    </article>
  )
}

function renderDocsLayout(
  markdown: ResolvedMarkdownPage,
  article: Readonly<ReactElement>,
  toc: Readonly<ReactElement> | undefined
): Readonly<ReactElement> {
  if (markdown.collectionNav === undefined) return article
  return (
    <div className="bg-background min-h-[calc(100dvh-4rem)]">
      {}
      <style dangerouslySetInnerHTML={{ __html: DOCS_PROSE_PATCH }} />
      <div className="mx-auto flex w-full max-w-screen-2xl items-start gap-4 px-4 lg:gap-8 lg:px-6">
        <DocsSidebarNav nav={markdown.collectionNav} />
        {article}
        {toc}
      </div>
    </div>
  )
}

function renderMarkdownBody(markdown: ResolvedMarkdownPage): Readonly<ReactElement> {
  const tocElement = renderToc(markdown)
  const sidebarToc = markdown.tocPosition === 'sidebar' ? tocElement : undefined
  const inlineToc = markdown.tocPosition === 'sidebar' ? undefined : tocElement
  const article = renderArticle(markdown, inlineToc, markdown.layout as 'prose' | 'docs' | 'full')
  if (markdown.layout === 'docs') {
    return renderDocsLayout(markdown, article, sidebarToc)
  }
  if (sidebarToc !== undefined) {
    return (
      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-12">
        {sidebarToc}
        <div className="flex-1">{article}</div>
      </div>
    )
  }
  return article
}

export function MarkdownArticle({ markdown }: MarkdownArticleProps): Readonly<ReactElement> {
  if (markdown.layout === 'none') return renderRawMarkdown(markdown)
  const body = renderMarkdownBody(markdown)
  const hasCode = markdown.html.includes('class="shiki')
  const hasToc = markdown.tocHeadings !== undefined && markdown.tocHeadings.length > 0
  if (!hasCode && !hasToc) return body
  return (
    <>
      {body}
      {hasCode && (
        <>
          {}
          <style dangerouslySetInnerHTML={{ __html: CODE_COPY_STYLE }} />
          {}
          <script dangerouslySetInnerHTML={{ __html: CODE_COPY_SCRIPT }} />
        </>
      )}
      {hasToc && (
        <>
          {}
          <style dangerouslySetInnerHTML={{ __html: TOC_SCROLLSPY_STYLE }} />
          {}
          <script dangerouslySetInnerHTML={{ __html: TOC_SCROLLSPY_SCRIPT }} />
        </>
      )}
    </>
  )
}
