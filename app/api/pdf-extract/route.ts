import { NextResponse } from "next/server";

export const runtime = "nodejs";

let workerInitialized = false;

async function ensurePdfJsWorker() {
  if (workerInitialized) return;
  const workerModule = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = workerModule;
  workerInitialized = true;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    const isFileLike =
      typeof file === "object" &&
      file !== null &&
      "arrayBuffer" in file &&
      typeof (file as { arrayBuffer?: unknown }).arrayBuffer === "function";

    if (!isFileLike) {
      return NextResponse.json(
        { error: "No PDF file uploaded." },
        { status: 400 },
      );
    }

    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    await ensurePdfJsWorker();
    const bytes = new Uint8Array(
      await (file as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer(),
    );
    const loadingTask = pdfjs.getDocument({
      data: bytes,
      useSystemFonts: true,
      disableWorker: true,
    });
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

    return NextResponse.json({ text: pages.join("\n\n") });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to parse PDF file.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
