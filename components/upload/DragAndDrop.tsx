"use client";

import React, { useRef, useState } from "react";
import { TbUpload } from "react-icons/tb";

interface DragAndDropProps {
  filesSetter: (files: FileList | null) => void;
}

export default function DragAndDrop({ filesSetter }: DragAndDropProps) {
  const [dragActive, setDragActive] = useState(false);
  const [fileLabel, setFileLabel] = useState<string>("");

  const inputRef = useRef<HTMLInputElement | null>(null);

  function openFileExplorer() {
    if (!inputRef.current) return;
    inputRef.current.value = "";
    inputRef.current.click();
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files ?? null;
    filesSetter(files);

    if (files && files.length > 0) {
      setFileLabel(files.length === 1 ? files[0].name : `${files.length} files selected`);
    } else {
      setFileLabel("");
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ?? null;
    filesSetter(files);

    if (files && files.length > 0) {
      setFileLabel(files.length === 1 ? files[0].name : `${files.length} files selected`);
    } else {
      setFileLabel("");
    }
  }

  return (
    <div className="flex items-center justify-center w-full">
      <form
        className={[
          "relative w-full aspect-square rounded-lg border border-dashed",
          dragActive ? "bg-white border-gray-300" : "bg-gray-50 border-gray-200",
          "flex flex-col items-center justify-center text-center cursor-pointer select-none",
        ].join(" ")}
        onClick={openFileExplorer}
        onSubmit={(e) => e.preventDefault()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept=".txt,.tex,.md,.pdf"
          onChange={handleChange}
        />

        <div className="flex flex-col items-center justify-center gap-2 px-6">
          <TbUpload size={44} className="text-gray-400" />
          <div className="text-sm text-gray-600">
            <span className="font-semibold">Click to upload</span> or drag and drop
          </div>
          <div className="text-xs text-gray-400">
            .txt / .tex / .md / .pdf (MAX. 25MB)
          </div>

          {fileLabel ? (
            <div className="mt-3 text-xs text-gray-600 truncate max-w-[260px]">
              Selected: {fileLabel}
            </div>
          ) : null}
        </div>
      </form>
    </div>
  );
}
