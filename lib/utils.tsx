import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import axios from "axios";
import OpenAI from "openai";
import { push, ref, set } from "firebase/database";
import { database } from "@/app/firebaseConfig";
import { useFileSuffixStore, useOpenAIAPIStore } from "@/lib/store";
import type { Sentence, Category } from "@/lib/type";

// Convert Category type (lowercase) to Feedback type (capitalized)
export function categoryToFeedbackType(category: string): string {
  const mapping: Record<string, string> = {
    "claim": "Claim",
    "reasoning": "Reasoning",
    "evidence": "Evidence",
    "rebuttal": "Rebuttal",
    "others": "Others",
    "orthography": "Orthography",
    "organization": "Organization",
    "word-usage": "Word Usage",
  };
  return mapping[category] || category;
}

export function eventTracker(
  event: object | string,
  id: string = useFileSuffixStore.getState().fileSuffix,
) {
  try {
    if (process.env.NODE_ENV !== "production") return;
    if (!id?.trim()) return;
    // console.log('event:', event);
    const refId = ref(database, "events/" + id);
    let newEvent: object = {};
    if (typeof event === "string") {
      newEvent = {
        event: event,
        timestamp: Date.now(),
      };
    } else {
      newEvent = {
        ...event,
        timestamp: Date.now(),
      };
    }
    push(refId, newEvent);
  } catch (error) {
    console.log("event:", event);
    console.error("Error tracking event:", error);
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Turn essay sentences into plain text (paragraphs separated by double newline). */
export function essayToPlainText(essay: Sentence[]): string {
  if (essay.length === 0) return "";
  const byParagraph = new Map<number, string[]>();
  for (const s of essay) {
    const p = s.paragraph ?? 1;
    if (!byParagraph.has(p)) byParagraph.set(p, []);
    byParagraph.get(p)!.push(s.content.trim());
  }
  const sortedParagraphs = Array.from(byParagraph.entries()).sort(
    (a, b) => a[0] - b[0],
  );
  return sortedParagraphs
    .map(([, sentences]) => sentences.join(" "))
    .join("\n\n");
}

/** Trigger download of the current essay as a .txt file. */
export function downloadEssayAsFile(
  essay: Sentence[],
  filename: string = "essay-revised.txt",
): void {
  const text = essayToPlainText(essay);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchData(
  url: string,
  payload: any,
  onSuccess?: (data: any) => void,
): Promise<any> {
  try {
    const response = await axios.post(url, payload);
    // console.log(response.data);
    if (onSuccess) {
      // Execute the onSuccess callback if provided
      console.log(url + " onSuccess");
      onSuccess(response.data);
    }
    return response.data; // Return data for cases where the response is needed
  } catch (error) {
    console.error("Error fetching data: ", error);
    throw error; // Rethrow the error so the caller can handle it
  }
}

export function isSimilarSentence(
  sentence: string,
  contentSentences: string[],
) {
  const words = sentence.toLowerCase().split(/\W+/).filter(Boolean);
  return contentSentences.some((contentSentence) => {
    const contentWords = contentSentence
      .toLowerCase()
      .split(/\W+/)
      .filter(Boolean);
    const commonWords = words.filter((word) => contentWords.includes(word));
    const similarity =
      commonWords.length / Math.max(words.length, contentWords.length);
    return similarity >= 0.65;
  });
}

export type ColorMap = {
  [key: string]: string;
};

export const categoryColorMap: ColorMap = {
  Claim: "#ec4899",
  Reasoning: "#ef4444",
  Evidence: "#f97316",
  Rebuttal: "#f59e0b",
  Others: "#78716c",
  Organization: "#8b5cf6",
  "Word-usage": "#06b6d4",
  "Word Usage": "#06b6d4",
  Orthography: "#3b82f6",
};

export const blockColorMap: ColorMap = {
  Default: "#F3F4F6",
  Prompt: "#1F2937",
  What: "#0284C7",
  Why: "#DC2626",
  How: "#EA580C",
  Revision: "#059669",
  Summary: "#4b5563",
};

export const getIntersection = (arr1: string[], arr2: string[]): string[] => {
  return arr1.filter((item) => arr2.includes(item));
};

export const getOpenAICompletion = async (
  prompt: string,
  input: string,
  temperature: number = 0.7,
  maxTokens: number = 256,
) => {
  const API = useOpenAIAPIStore.getState().API;
  const openai = new OpenAI({
    apiKey: API,
    dangerouslyAllowBrowser: true,
  });

  // console.log('prompt:', prompt);
  // console.log('input:', input);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: prompt,
        },
        {
          role: "user",
          content: input,
        },
      ],
      temperature: temperature,
      max_tokens: maxTokens,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });
    // console.log(response.choices[0].message.content);
    return response.choices[0].message.content;
  } catch (error: any) {
    console.error("Error fetching AI response:", error);
    const msg = error?.message ?? String(error);
    if (msg.includes("Incorrect API key") || msg.includes("Invalid API key")) {
      throw new Error("Invalid OpenAI API key. Please check and try again. Find your key at https://platform.openai.com/account/api-keys");
    }
    if (msg.includes("rate limit") || msg.includes("Rate limit")) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    if (msg.includes("network") || error?.name === "TypeError") {
      throw new Error("Network error. Please check your connection and try again.");
    }
    throw new Error(msg || "Something went wrong while generating feedback. Please try again.");
  }
};

export const getOpenAIBetterOrNot = async (
  original_sentence: string,
  revised_sentence: string,
) => {
  const API = useOpenAIAPIStore.getState().API;
  const openai = new OpenAI({
    apiKey: API,
    dangerouslyAllowBrowser: true,
  });

  try {
    const response = await openai.chat.completions.create({
      model: "ft:gpt-3.5-turbo-0613:jeff-rz-cornell-university::8ru54eYb",
      messages: [
        {
          role: "system",
          content:
            "Given the original sentence, determine whether the revision made the original sentence better or not.",
        },
        {
          role: "user",
          content:
            "original sentence: " +
            original_sentence +
            "\nrevision: " +
            revised_sentence +
            "\nbetter (Yes/No): ",
        },
      ],
      temperature: 0.0,
      max_tokens: 256,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    console.log(response.choices[0].message.content);
    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error fetching AI response:", error);
  }
};
