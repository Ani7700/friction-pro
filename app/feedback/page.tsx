"use client";

import React, { useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "flowbite-react";
import { TbCircleKeyFilled } from "react-icons/tb";

import { PageContext } from "./contexts";
import { FeedbackBigCard } from "@/components/feedback/FeedbackBigCard";
import { FeedbackFilter } from "@/components/feedback/FeedbackFilter";
import {
  useFeedbackStore,
  useGlobalSentenceStore,
  useGlobalFeedbackStore,
  useGlobalHumanPlanStore,
  useFeedbackSummaryStore,
} from "@/lib/store";
import { eventTracker } from "@/lib/utils";
import type { FeedbackItem, GlobalHumanReflectionItem } from "@/lib/type";

const HighlightSummary = ({ text }: { text: string }) => {
  const typeMap = {
    claim: "Claims/Ideas",
    reasoning: "Warrant/Reasoning/Backing",
    evidence: "Evidence",
    rebuttal: "Rebuttal/Reservation",
    others: "General Content",
    orthography: "Conventions/Grammar/Spelling",
    organization: "Organization",
    "word-usage": "Word Usage/Clarity",
  } as const;

  const keywords = ["Claim", "Reasoning", "Evidence", "Rebuttal", "Others", "Orthography", "Organization", "Word Usage"];

  const parts = text.split(/(\s+)/).map((part: string, index: number) => {
    const keyword = keywords.find((k) => part.includes(k));
    if (keyword) {
      let key = keyword.toLowerCase();
      // Handle special cases for multi-word types with hyphens
      if (keyword === "Word Usage") key = "word-usage";
      return (
        <span key={index}>
          <span className="font-semibold">{typeMap[key as keyof typeof typeMap]}</span>,
        </span>
      );
    }
    return part;
  });

  return <span className="text-xs">{parts}</span>;
};

const Feedback = () => {
  const normalizeFeedbackType = (type: string) =>
    type.trim().toLowerCase().replace(/\s+/g, "-");

  const { selectedType, setSelectedType } = useContext(PageContext);

  const feedbackSummary = useFeedbackSummaryStore((state) => state.feedbackSummary);

  const globalSentence = useGlobalSentenceStore((state) => state.globalSentence);

  const setGlobalFeedback = useGlobalFeedbackStore((state) => state.setGlobalFeedback);

  const globalHumanPlan = useGlobalHumanPlanStore((state) => state.globalHumanPlan);
  const initiateOneGlobalHumanPlan = useGlobalHumanPlanStore(
    (state) => state.initiateOneGlobalHumanPlan,
  );
  const ifSinglePlanCompletedBySentenceIdAndFeedback = useGlobalHumanPlanStore(
    (state) => state.ifSinglePlanCompletedBySentenceIdAndFeedback,
  );

  const getFeedbackBySentenceId = useFeedbackStore((state) => state.getFeedbackBySentenceId);
  const allFeedback = useFeedbackStore((state) => state.feedback);

  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem[] | undefined>([]);

  useEffect(() => {
    if (Object.keys(globalSentence).length === 0) {
      setSelectedFeedback(allFeedback);
      return;
    }

    const feedbackForThisSentence = getFeedbackBySentenceId(globalSentence.id);
    setSelectedFeedback(feedbackForThisSentence);

    const existingPlan = globalHumanPlan.find(
      (item) => item.sentence === globalSentence.content,
    );
    if (existingPlan) return;

    const reflection: GlobalHumanReflectionItem[] = [];
    feedbackForThisSentence?.forEach((item) => {
      reflection.push({ feedback: item.content, why: "", how: "" });
    });

    initiateOneGlobalHumanPlan({
      id: globalSentence.id,
      sentence: globalSentence.content,
      reflection,
    });
  }, [
    globalSentence,
    allFeedback,
    globalHumanPlan,
    getFeedbackBySentenceId,
    initiateOneGlobalHumanPlan,
  ]);

  const [searchText, setSearchText] = useState("");
  const [selectedFile, setSelectedFile] = useState("All");
  const [selectedEngagementRange, setSelectedEngagementRange] = useState("All");
  const [sentiment, setSentiment] = useState(0);
  const [actionability, setActionability] = useState(0);
  const [justification, setJustification] = useState(0);
  const [specificity, setSpecificity] = useState(0);
  const [engagement, setEngagement] = useState(0);

  useEffect(() => {
    eventTracker({
      event: "view_feedback_page",
      sentence: Object.keys(globalSentence).length === 0 ? "all" : globalSentence.id,
    });
  }, [globalSentence]);

  const sortedFeedback = useMemo(() => {
    const contentFeedback = selectedFeedback?.filter((item) => ![""].includes(item.type));
    if (!contentFeedback) return undefined;

    return [...contentFeedback].sort((a, b) => {
      if (a.source !== b.source) return b.source - a.source;
      return b.engagement - a.engagement;
    });
  }, [selectedFeedback]);

  const uniqueFiles = useMemo(() => {
    const files = sortedFeedback?.map((item) => item.file) ?? [];
    return ["All", ...Array.from(new Set(files))];
  }, [sortedFeedback]);

  const uniqueTypes = useMemo(() => {
    const types = sortedFeedback?.map((item) => item.type) ?? [];
    return ["All", ...Array.from(new Set(types))];
  }, [sortedFeedback]);

  const filteredFeedback = useMemo(() => {
    return sortedFeedback?.filter((item) => {
      const itemType = normalizeFeedbackType(item.type);
      const selectedTypeNormalized = normalizeFeedbackType(selectedType);
      const matchesOtherFilters =
        item.content.toLowerCase().includes(searchText.toLowerCase()) &&
        (selectedFile === "All" || item.file === selectedFile) &&
        (selectedType === "All" || itemType === selectedTypeNormalized) &&
        (selectedEngagementRange === "All" ||
          (item.engagement >= (parseInt(selectedEngagementRange) - 1) * 1 &&
            item.engagement < parseInt(selectedEngagementRange) * 1)) &&
        item.actionability >= actionability &&
        item.justification >= justification &&
        item.specificity >= specificity &&
        item.sentiment >= sentiment &&
        item.actionability + item.justification + item.specificity + item.sentiment >= engagement;

      return matchesOtherFilters;
    });
  }, [
    sortedFeedback,
    searchText,
    selectedFile,
    selectedType,
    selectedEngagementRange,
    sentiment,
    actionability,
    justification,
    specificity,
    engagement,
  ]);

  useEffect(() => {
    if (!filteredFeedback || filteredFeedback.length === 0) return;

    setGlobalFeedback(filteredFeedback);

    eventTracker({
      event: "view_feedback",
      sentence: Object.keys(globalSentence).length === 0 ? "all" : globalSentence.id,
      keywords: searchText.toLowerCase(),
      file: selectedFile.toLowerCase(),
      type: selectedType.toLowerCase(),
      engagement: selectedEngagementRange.toLowerCase(),
    });
  }, [
    filteredFeedback,
    globalSentence,
    searchText,
    selectedFile,
    selectedType,
    selectedEngagementRange,
    setGlobalFeedback,
  ]);

  return (
    <div className="flex flex-col h-screen w-full py-4 px-8 bg-gray-50 text-gray-800">
      <div className="flex flex-col gap-2">
        <div className="border-2 p-4 bg-white rounded-lg text-sm">
          <div className="flex flex-row gap-2 items-center pb-2 font-medium">
            <TbCircleKeyFilled size={20} />
            <p>Feedback Overview</p>
          </div>
          <HighlightSummary text={feedbackSummary} />
        </div>

        <FeedbackFilter
          searchText={searchText}
          setSearchText={setSearchText}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          uniqueFiles={uniqueFiles}
          selectedType={selectedType}
          setSelectedType={setSelectedType}
          uniqueTypes={uniqueTypes}
          selectedEngagementRange={selectedEngagementRange}
          setSelectedEngagementRange={setSelectedEngagementRange}
          sentiment={sentiment}
          setSentiment={setSentiment}
          actionability={actionability}
          setActionability={setActionability}
          justification={justification}
          setJustification={setJustification}
          specificity={specificity}
          setSpecificity={setSpecificity}
          engagement={engagement}
          setEngagement={setEngagement}
        />

        <div className="border-t border-dashed border-gray-200 w-full my-2" />
      </div>

      <div className="overflow-y-auto grow py-2 pb-40">
        <div className="flex flex-col gap-2 mx-2">
          {filteredFeedback && filteredFeedback.length > 0 ? (
            filteredFeedback.map((item) => (
              <div key={item.id} className="flex flex-col gap-2">
                <FeedbackBigCard
                  feedbackItem={item}
                  classes={`relative rounded-lg hover:scale-[1.01] transition-all duration-150 ${
                    ifSinglePlanCompletedBySentenceIdAndFeedback(
                      globalSentence.id,
                      item.content,
                    )
                      ? "overflow-hidden ring-2 ring-emerald-500 ring-offset-2 ring-offset-emerald-100 before:content-[''] before:absolute before:-m-5 before:w-10 before:h-10 before:rotate-45 before:bg-emerald-500"
                      : ""
                  }`}
                  close={true}
                  selectedFeedback={selectedFeedback}
                  setSelectedFeedback={setSelectedFeedback}
                />
                <div className="border-t border-dashed border-gray-200 w-full" />
              </div>
            ))
          ) : (
            <p className="mx-6 text-sm text-gray-400 select-none">No feedback available.</p>
          )}
        </div>
      </div>

      {Object.keys(globalSentence).length !== 0 && (
        <Link
          href="/plan"
          onClick={(e) => {
            if (!filteredFeedback || filteredFeedback.length === 0) {
              e.preventDefault();
              alert("Please keep at least a feedback item before proceeding to reflection.");
            }
          }}
        >
          <Button
            color="dark"
            className="z-50 fixed bottom-6 right-8 w-40 cursor-pointer enabled:hover:ring-white enabled:ring-white hover:ring-white transition-all duration-150 hover:scale-105"
          >
            Go to Plan
          </Button>
        </Link>
      )}
    </div>
  );
};

export default Feedback;
