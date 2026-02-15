"use client";

import React, { useEffect, useState } from "react";
import {
  useEssayStore,
  useFileSuffixStore,
  useFeedbackStore,
  useFeedbackCategoryDistributionStore,
  useFeedbackSummaryStore,
} from "@/lib/store";
import { eventTracker } from "@/lib/utils";
import { FileUploader } from "@/components/upload/FileUploader";
import { essay } from "@/lib/data/essay";
import { feedback } from "@/lib/data/feedback";
import type { FeedbackSourceItem } from "@/lib/type";
import {
  generateFeedbackForEssay,
  buildFeedbackSummary,
} from "@/lib/feedbackGen";

const CATEGORIES = [
  "claim",
  "reasoning",
  "evidence",
  "rebuttal",
  "others",
  "organization",
  "word-usage",
  "orthography",
] as const;

function setDistributionFromFeedback(
  feedbackList: { type: string; plan: { what: number[] }[] }[],
  essayLength: number,
) {
  for (const category of CATEGORIES) {
    const distribution: { [key: number]: number } = {};
    for (let i = 1; i <= essayLength; i++) {
      distribution[i] = 0;
    }
    feedbackList.forEach((item) => {
      const itemCategory = item.type.toLowerCase().replace(/\s+/g, "-");
      if (itemCategory === category) {
        item.plan.forEach((planItem) => {
          planItem.what.forEach((whatValue) => {
            if (distribution[whatValue] !== undefined) {
              distribution[whatValue]++;
            }
          });
        });
      }
    });
    useFeedbackCategoryDistributionStore.setState({
      [category]: distribution,
    });
  }
}

const SUBMIT_ERROR_KEY = "friction_submit_error";

const Upload = () => {
  const [persistedError, setPersistedError] = useState("");

  useEffect(() => {
    useFileSuffixStore.getState().setFileSuffix("");
    eventTracker({
      event: "view_home_page",
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = sessionStorage.getItem(SUBMIT_ERROR_KEY);
    if (stored) {
      sessionStorage.removeItem(SUBMIT_ERROR_KEY);
      setPersistedError(stored);
    }
  }, []);

  const onClick = async (
    _feedbackArg: FeedbackSourceItem[],
    essayText: string,
  ): Promise<void> => {
    eventTracker({
      event: "click_upload_button",
    });

    const isUserUpload = Boolean(essayText?.trim());

    if (isUserUpload) {
      const currentEssay = useEssayStore.getState().essay;
      if (currentEssay.length === 0) return;
      try {
        const generated = await generateFeedbackForEssay(currentEssay);
        useFeedbackStore.setState({ feedback: generated });
        useFeedbackSummaryStore.setState({
          feedbackSummary: buildFeedbackSummary(generated),
        });
        setDistributionFromFeedback(generated, currentEssay.length);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to generate. Please check your network and API key, then try again.";
        if (typeof window !== "undefined") {
          sessionStorage.setItem(SUBMIT_ERROR_KEY, message);
        }
        throw err;
      }
    } else {
      useEssayStore.setState({ essay });
      useFeedbackStore.setState({ feedback });
      useFeedbackSummaryStore.setState({
        feedbackSummary:
          "Feedback highlights three key issues for potential revision: Evidence, with 17 comments suggesting improvements to 12 sentences; Reasoning, with 9 comments targeting 10 sentences; and Claim, with 6 comments addressing 6 sentences.",
      });
      setDistributionFromFeedback(feedback, essay.length);
    }
  };

  return (
    <div className="bg-gray-50 text-gray-800 min-h-screen w-full flex items-center justify-center">
      <FileUploader
        onClick={onClick}
        persistedError={persistedError}
        onClearPersistedError={() => setPersistedError("")}
      />
    </div>
  );
};

export default Upload;
