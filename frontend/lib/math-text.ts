export type MathTextPart = {
  kind: "text" | "inline-math" | "block-math";
  value: string;
};

const MATH_DELIMITERS = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g;

export function parseMathText(value: string): MathTextPart[] {
  const parts: MathTextPart[] = [];
  let cursor = 0;

  for (const match of value.matchAll(MATH_DELIMITERS)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ kind: "text", value: value.slice(cursor, index) });

    const token = match[0];
    const block = token.startsWith("$$") || token.startsWith("\\[");
    const delimiterLength = token.startsWith("$") && !token.startsWith("$$") ? 1 : 2;
    parts.push({
      kind: block ? "block-math" : "inline-math",
      value: token.slice(delimiterLength, -delimiterLength).trim(),
    });
    cursor = index + token.length;
  }

  if (cursor < value.length) parts.push({ kind: "text", value: value.slice(cursor) });
  return parts.length ? parts : [{ kind: "text", value }];
}
