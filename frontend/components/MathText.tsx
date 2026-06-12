"use client";

import { Fragment } from "react";
import { Tex } from "@/components/Tex";
import { parseMathText } from "@/lib/math-text";

export function MathText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {parseMathText(text).map((part, index) => (
        <Fragment key={`${part.kind}-${index}`}>
          {part.kind === "text" && <span className="whitespace-pre-wrap">{part.value}</span>}
          {part.kind === "inline-math" && <Tex tex={part.value} className="mx-0.5 text-text" />}
          {part.kind === "block-math" && (
            <div className="my-3 overflow-x-auto">
              <Tex tex={part.value} block className="text-text" />
            </div>
          )}
        </Fragment>
      ))}
    </div>
  );
}
