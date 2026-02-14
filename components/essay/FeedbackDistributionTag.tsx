import React from 'react';
import { noto_serif } from '@/app/fonts';

export const FeedbackDistributionTag = () => {
  return (
    <div>
      <div
        className={
          noto_serif.className +
          ' absolute right-[200px] top-8 bg-pink-500 w-[24px] h-[24px] rounded text-center text-white text-sm font-bold flex justify-center items-center italic'
        }
      >
        <p>C</p>
      </div>
      <div
        className={
          noto_serif.className +
          ' absolute right-[176px] top-8 bg-red-500 w-[24px] h-[24px] rounded text-center text-white text-sm font-bold flex justify-center items-center italic'
        }
      >
        <p>W</p>
      </div>
      <div
        className={
          noto_serif.className +
          ' absolute right-[152px] top-8 bg-orange-500 w-[24px] h-[24px] rounded text-center text-white text-sm font-bold flex justify-center items-center italic'
        }
      >
        <p>E</p>
      </div>
      <div
        className={
          noto_serif.className +
          ' absolute right-[128px] top-8 bg-amber-500 w-[24px] h-[24px] rounded text-center text-white text-sm font-bold flex justify-center items-center italic'
        }
      >
        <p>R</p>
      </div>
      <div
        className={
          noto_serif.className +
          ' absolute right-[104px] top-8 bg-stone-500 w-[24px] h-[24px] rounded text-center text-white text-sm font-bold flex justify-center items-center italic'
        }
      >
        <p>G</p>
      </div>
      <div
        className={
          noto_serif.className +
          ' absolute right-[80px] top-8 bg-violet-500 w-[24px] h-[24px] rounded text-center text-white text-sm font-bold flex justify-center items-center italic'
        }
      >
        <p>C</p>
      </div>
      <div
        className={
          noto_serif.className +
          ' absolute right-[56px] top-8 bg-blue-500 w-[24px] h-[24px] rounded text-center text-white text-sm font-bold flex justify-center items-center italic'
        }
      >
        <p>O</p>
      </div>
      <div
        className={
          noto_serif.className +
          ' absolute right-[32px] top-8 bg-cyan-500 w-[24px] h-[24px] rounded text-center text-white text-sm font-bold flex justify-center items-center italic'
        }
      >
        <p>U</p>
      </div>
    </div>
  );
};
