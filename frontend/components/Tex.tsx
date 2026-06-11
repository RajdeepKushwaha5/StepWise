"use client";

import katex from "katex";
import "katex/dist/katex.min.css";

/** Render a Wolfram TeXForm string as typeset math. Falls back to the raw string
 *  (never throws) so a quirky TeX expression can't break the page. */
export function Tex({ tex, block = false, className }: { tex: string; block?: boolean; className?: string }) {
  const html = katex.renderToString(tex, {
    throwOnError: false,
    displayMode: block,
    output: "html",
    strict: false,
  });
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
