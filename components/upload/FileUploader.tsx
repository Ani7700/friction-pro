"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "flowbite-react";

import DragAndDrop from "./DragAndDrop";
import { noto_serif } from "@/app/fonts";
import { FeedbackSourceItem, Sentence } from "@/lib/type";
import { useEssayStore, useOpenAIAPIStore } from "@/lib/store";

type FileUploaderProps = {
  onClick: (
    feedback: FeedbackSourceItem[],
    essay: string,
  ) => void | Promise<void>;
};

const MAX_FILE_SIZE_BYTES = 4.5 * 1024 * 1024;

function isPdf(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase();
  return file.type === "application/pdf" || ext === "pdf";
}

function isSupportedTextFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext === "txt" || ext === "tex" || ext === "md";
}

async function extractPdfText(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/pdf-extract", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let message = "Failed to parse PDF file.";
    try {
      const data = (await response.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      // Keep default message if response is not JSON.
    }
    throw new Error(message);
  }

  const data = (await response.json()) as { text?: string };
  return data.text ?? "";
}

async function extractEssayText(file: File): Promise<string> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("File is too large. Please upload a file up to 4.5MB.");
  }
  if (isPdf(file)) return extractPdfText(file);
  if (!isSupportedTextFile(file)) {
    throw new Error("Only .txt, .tex, .md, and .pdf files are supported.");
  }
  return await file.text();
}

function parseEssayTextToSentences(text: string): Sentence[] {
  const maskMathBlocks = (input: string) => {
    const tokens: string[] = [];
    const masked = input.replace(
      /\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$|\$(?:\\.|[^$\n])+\$/g,
      (match) => {
        const token = `__MATH_BLOCK_${tokens.length}__`;
        tokens.push(match);
        return token;
      },
    );
    return {
      masked,
      restore: (value: string) =>
        value.replace(/__MATH_BLOCK_(\d+)__/g, (_, idx: string) => {
          const i = Number(idx);
          return Number.isFinite(i) && tokens[i] ? tokens[i] : "";
        }),
    };
  };

  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  let id = 1;
  const out: Sentence[] = [];

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const { masked, restore } = maskMathBlocks(paragraphs[pIdx]);
    const sents = masked
      .split(/(?<=[.!?])\s+/)
      .map((s) => restore(s.trim()))
      .filter(Boolean);

    for (const s of sents) {
      out.push({ id: id++, paragraph: pIdx + 1, content: s } as Sentence);
    }
  }

  return out;
}

export function FileUploader(props: FileUploaderProps) {
  const router = useRouter();

  const API = useOpenAIAPIStore((state) => state.API);
  const setAPI = useOpenAIAPIStore((state) => state.setAPI);

  const setEssayStore = useEssayStore((s) => s.setEssay);

  const [essay, setEssay] = useState<FileList | null>();
  const [essayText, setEssayText] = useState<string>("");
  const [selectedName, setSelectedName] = useState<string>("");
  const [uploadError, setUploadError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAPIInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAPI(event.target.value);
  };

  useEffect(() => {
    if (!essay || essay.length === 0) return;

    const file = essay[0];
    setSelectedName(file?.name || "");
    setUploadError("");

    let cancelled = false;
    (async () => {
      try {
        const text = await extractEssayText(file);
        if (cancelled) return;
        setEssayText(text);
      } catch (error) {
        if (cancelled) return;
        setEssayText("");
        const message =
          error instanceof Error
            ? error.message
            : "Failed to parse this file. Try another file format.";
        setUploadError(message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [essay]);

  const canStart = useMemo(() => {
    return API.trim() !== "" && essayText.trim().length > 0;
  }, [API, essayText]);

  return (
    <div className="grid grid-cols-2 gap-2 p-8 bg-white rounded-lg border border-gray-800 w-[512px] select-none mb-32">
      <div className="col-span-2 flex flex-col gap-4">
        <p className={noto_serif.className}>Hi there! Welcome to Friction!</p>
      </div>

      <div className="col-span-2">
        <p className="text-sm mb-1 text-gray-400">Essay</p>
        <DragAndDrop filesSetter={setEssay} />
        {selectedName ? (
          <p className="text-xs text-gray-400 mt-2">Selected: {selectedName}</p>
        ) : null}
        {uploadError ? (
          <p className="text-xs text-red-500 mt-1">{uploadError}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 col-span-2">
        <input
          type="text"
          value={API}
          placeholder="Your OpenAI API Key..."
          onChange={handleAPIInputChange}
          className="w-full p-2 border text-sm border-gray-300 rounded-lg grow-0"
        />

        <Button
          color="dark"
          className="w-full"
          disabled={!canStart || isSubmitting}
          onClick={async () => {
            setEssayStore(parseEssayTextToSentences(essayText));
            setIsSubmitting(true);
            try {
              await props.onClick([], essayText);
              router.push("/feedback");
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          {isSubmitting ? "Generating feedback…" : "Start Friction"}
        </Button>
      </div>
    </div>
  );
}
