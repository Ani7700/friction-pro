"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "flowbite-react";

import DragAndDrop from "./DragAndDrop";
import { noto_serif } from "@/app/fonts";
import { FeedbackSourceItem, Sentence } from "@/lib/type";
import {
  useEssayStore,
  useFileSuffixStore,
  useOpenAIAPIStore,
} from "@/lib/store";

type FileUploaderProps = {
  onClick: (
    feedback: FeedbackSourceItem[],
    essay: string,
  ) => void | Promise<void>;
  persistedError?: string;
  onClearPersistedError?: () => void;
};

const MAX_FILE_SIZE_BYTES = 4.5 * 1024 * 1024;
const PARTICIPANT_ID_REGEX = /^[a-zA-Z0-9_-]{1,32}$/;
const SUBMIT_ERROR_KEY = "friction_submit_error";
const PDF_PARSE_TIMEOUT_MS = 45_000;

function isPdf(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase();
  return file.type === "application/pdf" || ext === "pdf";
}

function isSupportedTextFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext === "txt" || ext === "tex" || ext === "md";
}

async function extractPdfTextInBrowser(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    disableWorker: true,
    useSystemFonts: true,
  } as unknown as Parameters<typeof pdfjs.getDocument>[0]);
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) =>
        "str" in (item as { str?: string })
          ? (item as { str?: string }).str
          : "",
      )
      .join(" ")
      .trim();
    pages.push(text);
  }

  return pages.join("\n\n");
}

async function tryExtractPdfTextViaApi(file: File): Promise<string | null> {
  const formData = new FormData();
  formData.append("file", file);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PDF_PARSE_TIMEOUT_MS);
  try {
    const response = await fetch("/api/pdf-extract", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return null;
    }

    const data = (await response.json()) as { text?: string; error?: string };
    if (!response.ok) {
      throw new Error(data.error || "Failed to parse PDF file.");
    }
    if (typeof data.text !== "string") return null;
    return data.text;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("PDF parsing timed out. Please try a smaller file.");
    }
    const online = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (!online) {
      throw new Error("Network error. Please check your connection and try again.");
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function extractPdfText(file: File): Promise<string> {
  const fromApi = await tryExtractPdfTextViaApi(file);
  if (fromApi !== null) return fromApi;
  return extractPdfTextInBrowser(file);
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
  const setFileSuffix = useFileSuffixStore((state) => state.setFileSuffix);

  const setEssayStore = useEssayStore((s) => s.setEssay);

  const [essay, setEssay] = useState<FileList | null>();
  const [essayText, setEssayText] = useState<string>("");
  const [participantId, setParticipantId] = useState<string>("");
  const [selectedName, setSelectedName] = useState<string>("");
  const [uploadError, setUploadError] = useState<string>("");
  const [submitError, setSubmitError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(SUBMIT_ERROR_KEY);
    if (stored) {
      sessionStorage.removeItem(SUBMIT_ERROR_KEY);
      setSubmitError(stored);
    }
  }, []);

  const displayError = submitError || props.persistedError || "";

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
    const normalizedId = participantId.trim();
    return (
      API.trim() !== "" &&
      essayText.trim().length > 0 &&
      PARTICIPANT_ID_REGEX.test(normalizedId)
    );
  }, [API, essayText, participantId]);

  return (
    <div className="relative grid grid-cols-2 gap-2 p-8 bg-white rounded-lg border border-gray-800 w-[512px] select-none mb-32">
      {isSubmitting ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/90"
          aria-hidden
        >
          <p className={noto_serif.className + " text-gray-600"}>
            Generating feedback…
          </p>
        </div>
      ) : null}
      <div className="col-span-2 flex flex-col gap-4">
        <p className={noto_serif.className}>Hi there! Welcome to Friction!</p>
      </div>

      <div className="col-span-2">
        <p className="text-sm mb-1 text-gray-400">Essay</p>
        <DragAndDrop filesSetter={isSubmitting ? () => {} : setEssay} />
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
          value={participantId}
          placeholder="Participant ID (e.g. p01)"
          onChange={(event) => setParticipantId(event.target.value)}
          disabled={isSubmitting}
          className="w-full p-2 border text-sm border-gray-300 rounded-lg grow-0 disabled:opacity-60 disabled:cursor-not-allowed"
        />
        {participantId.trim() !== "" &&
        !PARTICIPANT_ID_REGEX.test(participantId.trim()) ? (
          <p className="text-xs text-red-500">
            ID may only contain letters, numbers, underscores or hyphens, up to 32 characters.
          </p>
        ) : null}

        <input
          type="text"
          value={API}
          placeholder="Your OpenAI API Key..."
          onChange={handleAPIInputChange}
          disabled={isSubmitting}
          className="w-full p-2 border text-sm border-gray-300 rounded-lg grow-0 disabled:opacity-60 disabled:cursor-not-allowed"
        />

        {displayError ? (
          <p className="text-xs text-red-500 col-span-2">{displayError}</p>
        ) : null}
        <Button
          color="dark"
          className="w-full col-span-2"
          disabled={!canStart || isSubmitting}
          onClick={async () => {
            const normalizedId = participantId.trim();
            setFileSuffix(normalizedId);
            setEssayStore(parseEssayTextToSentences(essayText));
            setSubmitError("");
            props.onClearPersistedError?.();
            sessionStorage.removeItem(SUBMIT_ERROR_KEY);
            setIsSubmitting(true);
            try {
              await props.onClick([], essayText);
              router.push("/feedback");
            } catch (err) {
              const message =
                err instanceof Error
                  ? err.message
                  : "Failed to generate. Please check your network and API key, then try again.";
              setSubmitError(message);
              sessionStorage.setItem(SUBMIT_ERROR_KEY, message);
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
