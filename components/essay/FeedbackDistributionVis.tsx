import React from "react";
import { useState } from "react";
import { DensityRect } from "@/components/essay/DensityRect";

type FeedbackDistributionVisProps = {
  id: number;
  claimSpans: any;
  reasoningSpans: any;
  evidenceSpans: any;
  rebuttalSpans: any;
  othersSpans: any;
  orthographySpans: any;
  organizationSpans: any;
  wordUsageSpans: any;
  selectedType?: string;
  setSelectedType?: (selectedType: string) => void;
};

export const FeedbackDistributionVis = (
  props: FeedbackDistributionVisProps,
) => {
  const [hoverTip, setHoverTip] = useState<{
    text: string;
    x: number;
    y: number;
    density?: number;
  } | null>(null);

  const handleCategoryClick = (type: string) => {
    if (!props.setSelectedType) return;
    props.setSelectedType(type);
  };

  return (
    <>
      {props.claimSpans[props.id - 1] && (
        <span onClick={() => handleCategoryClick("Claim")}>
          <DensityRect
            id={props.id}
            spanData={props.claimSpans[props.id - 1]}
            rightOffset="184"
            category="Claim"
            text="Claims/Ideas"
            width={24}
            setHoverTip={setHoverTip}
          />
        </span>
      )}
      {props.reasoningSpans[props.id - 1] && (
        <span onClick={() => handleCategoryClick("Reasoning")}>
          <DensityRect
            id={props.id}
            spanData={props.reasoningSpans[props.id - 1]}
            rightOffset="160"
            category="Reasoning"
            text="Warrant/Reasoning/Backing"
            width={24}
            setHoverTip={setHoverTip}
          />
        </span>
      )}
      {props.evidenceSpans[props.id - 1] && (
        <span onClick={() => handleCategoryClick("Evidence")}>
          <DensityRect
            id={props.id}
            spanData={props.evidenceSpans[props.id - 1]}
            rightOffset="136"
            category="Evidence"
            text="Evidence"
            width={24}
            setHoverTip={setHoverTip}
          />
        </span>
      )}
      {props.rebuttalSpans[props.id - 1] && (
        <span onClick={() => handleCategoryClick("Rebuttal")}>
          <DensityRect
            id={props.id}
            spanData={props.rebuttalSpans[props.id - 1]}
            rightOffset="112"
            category="Rebuttal"
            text="Rebuttal/Reservation"
            width={24}
            setHoverTip={setHoverTip}
          />
        </span>
      )}
      {props.othersSpans[props.id - 1] && (
        <span onClick={() => handleCategoryClick("Others")}>
          <DensityRect
            id={props.id}
            spanData={props.othersSpans[props.id - 1]}
            rightOffset="88"
            category="Others"
            text="General Content"
            width={24}
            setHoverTip={setHoverTip}
          />
        </span>
      )}
      {props.orthographySpans[props.id - 1] && (
        <span onClick={() => handleCategoryClick("Orthography")}>
          <DensityRect
            id={props.id}
            spanData={props.orthographySpans[props.id - 1]}
            rightOffset="64"
            category="Orthography"
            text="Conventions/Grammar/Spelling"
            width={24}
            setHoverTip={setHoverTip}
          />
        </span>
      )}
      {props.organizationSpans[props.id - 1] && (
        <span onClick={() => handleCategoryClick("Organization")}>
          <DensityRect
            id={props.id}
            spanData={props.organizationSpans[props.id - 1]}
            rightOffset="40"
            category="Organization"
            text="Organization"
            width={24}
            setHoverTip={setHoverTip}
          />
        </span>
      )}
      {props.wordUsageSpans[props.id - 1] && (
        <span onClick={() => handleCategoryClick("Word Usage")}>
          <DensityRect
            id={props.id}
            spanData={props.wordUsageSpans[props.id - 1]}
            rightOffset="16"
            category="Word Usage"
            text="Word Usage/Clarity"
            width={24}
            setHoverTip={setHoverTip}
          />
        </span>
      )}

      {hoverTip && (
        <div
          className="fixed whitespace-nowrap rounded-lg bg-white -translate-x-full -translate-y-full shadow-lg p-2 z-30 border text-[10px] leading-3 font-medium"
          style={{
            left: `${hoverTip.x}px`,
            top: `${hoverTip.y + 25}px`,
          }}
        >
          # {hoverTip.text}: ({hoverTip.density})
        </div>
      )}
    </>
  );
};
