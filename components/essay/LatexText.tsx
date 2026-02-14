"use client";

import React from "react";
import katex from "katex";

type LatexTextProps = {
  text: string;
};

const LATEX_MATH = /\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$\$([\s\S]+?)\$\$|\$([^$\n]+)\$/g;
const LATEX_SECTION = /\\section\{([^}]*)\}|\\subsection\{([^}]*)\}/g;

function renderMath(math: string, displayMode: boolean): string {
  return katex.renderToString(math, {
    throwOnError: false,
    displayMode,
    strict: "warn",
  });
}

export default function LatexText({ text }: LatexTextProps) {
  const renderPlainWithSections = (plainText: string): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    let plainLast = 0;
    let plainKey = 0;

    for (const sectionMatch of plainText.matchAll(LATEX_SECTION)) {
      const start = sectionMatch.index ?? 0;
      const end = start + sectionMatch[0].length;
      const before = plainText.slice(plainLast, start);
      if (before) {
        nodes.push(
          <React.Fragment key={`plain-txt-${plainKey++}`}>{before}</React.Fragment>,
        );
      }

      const sectionTitle = sectionMatch[1];
      const subsectionTitle = sectionMatch[2];
      const isSection = Boolean(sectionTitle);
      const title = (sectionTitle ?? subsectionTitle ?? "").trim();

      nodes.push(
        <span
          key={`plain-sec-${plainKey++}`}
          className={isSection ? "block text-2xl font-semibold my-4" : "block text-xl font-semibold my-3"}
        >
          {title}
        </span>,
      );
      plainLast = end;
    }

    const tail = plainText.slice(plainLast);
    if (tail) {
      nodes.push(
        <React.Fragment key={`plain-txt-${plainKey++}`}>{tail}</React.Fragment>,
      );
    }

    return nodes.length > 0 ? nodes : [plainText];
  };

  const chunks: React.ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const match of text.matchAll(LATEX_MATH)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const plain = text.slice(last, start);
    if (plain) {
      for (const node of renderPlainWithSections(plain)) {
        chunks.push(<React.Fragment key={`txt-${key++}`}>{node}</React.Fragment>);
      }
    }

    const bracketDisplayMath = match[1];
    const bracketInlineMath = match[2];
    const dollarDisplayMath = match[3];
    const dollarInlineMath = match[4];
    const math =
      bracketDisplayMath ??
      bracketInlineMath ??
      dollarDisplayMath ??
      dollarInlineMath ??
      "";
    const displayMode = Boolean(bracketDisplayMath ?? dollarDisplayMath);
    chunks.push(
      <span
        key={`math-${key++}`}
        className={displayMode ? "block my-1" : undefined}
        dangerouslySetInnerHTML={{ __html: renderMath(math, displayMode) }}
      />,
    );
    last = end;
  }

  const tail = text.slice(last);
  if (tail) {
    for (const node of renderPlainWithSections(tail)) {
      chunks.push(<React.Fragment key={`txt-${key++}`}>{node}</React.Fragment>);
    }
  }

  return <>{chunks.length > 0 ? chunks : text}</>;
}
