import { jsPDF } from "jspdf";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 20;
const TEXT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const IMAGE_MAX_HEIGHT = 140;
const IMAGE_MAX_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const LINE_HEIGHT = 6;
const TITLE_FONT_SIZE = 18;
const BODY_FONT_SIZE = 11;

/**
 * Fetch image URL and return as base64 data URL, or null if failed (e.g. CORS).
 */
function resolveUrl(url) {
  if (!url || typeof url !== "string") return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
  return base + (url.startsWith("/") ? url : "/" + url);
}

async function imageUrlToDataUrl(url) {
  if (!url || typeof url !== "string") return null;
  const resolved = resolveUrl(url);
  try {
    const res = await fetch(resolved, { mode: "cors", credentials: "omit" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Wrap text to fit within maxWidth; returns array of lines.
 */
function wrapText(doc, text, maxWidth) {
  if (!text || !text.trim()) return [];
  const lines = doc.splitTextToSize(text.trim(), maxWidth);
  return lines;
}

/**
 * Generate and download a PDF for the given story.
 * @param {Object} story - Story object with storyPages, cover, etc.
 * @param {Object} options - { onProgress?: (message: string) => void }
 */
export async function downloadStoryPdf(story, options = {}) {
  const { onProgress } = options;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const title = story?.storyPages?.title || "Untitled Story";
  const summary = story?.storyPages?.summary || "";
  const cover = story?.cover;
  const pages = story?.storyPages?.pages || [];
  const safeFilename = title.replace(/[^a-z0-9_-]/gi, "_").slice(0, 80) || "story";

  const report = (msg) => {
    if (typeof onProgress === "function") onProgress(msg);
  };

  let pageCount = 0;

  // Cover page: title, optional summary, optional cover image
  doc.addPage();
  pageCount += 1;
  report("Adding cover...");
  doc.setFontSize(TITLE_FONT_SIZE + 4);
  doc.setFont("helvetica", "bold");
  const titleLines = wrapText(doc, title, TEXT_WIDTH);
  let y = MARGIN + 20;
  titleLines.forEach((line) => {
    doc.text(line, MARGIN, y);
    y += LINE_HEIGHT + 2;
  });
  y += 8;
  if (summary) {
    doc.setFontSize(BODY_FONT_SIZE);
    doc.setFont("helvetica", "normal");
    const sumLines = wrapText(doc, summary, TEXT_WIDTH);
    sumLines.forEach((line) => {
      if (y > PAGE_HEIGHT - MARGIN - 20) {
        doc.addPage();
        pageCount += 1;
        y = MARGIN;
      }
      doc.text(line, MARGIN, y);
      y += LINE_HEIGHT;
    });
    y += 10;
  }
  if (cover?.illustrationUrl && y < PAGE_HEIGHT - IMAGE_MAX_HEIGHT - MARGIN) {
    const dataUrl = await imageUrlToDataUrl(cover.illustrationUrl);
    if (dataUrl) {
      try {
        const imgType = dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
        doc.addImage(dataUrl, imgType, MARGIN, y, IMAGE_MAX_WIDTH, IMAGE_MAX_HEIGHT);
      } catch {
        // ignore invalid image
      }
    }
  }

  // Story pages: text on top, then illustration below
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    doc.addPage();
    pageCount += 1;
    report(`Adding page ${i + 1} of ${pages.length}...`);
    let y = MARGIN;

    doc.setFontSize(BODY_FONT_SIZE);
    doc.setFont("helvetica", "normal");
    const text = page.text || "";
    const textLines = wrapText(doc, text, TEXT_WIDTH);
    for (const line of textLines) {
      if (y > PAGE_HEIGHT - MARGIN - IMAGE_MAX_HEIGHT - 20) {
        doc.addPage();
        pageCount += 1;
        y = MARGIN;
      }
      doc.text(line, MARGIN, y);
      y += LINE_HEIGHT;
    }
    y += 10;

    const pageImageUrl = page.illustrationUrl;
    if (pageImageUrl && y < PAGE_HEIGHT - IMAGE_MAX_HEIGHT - MARGIN) {
      const dataUrl = await imageUrlToDataUrl(pageImageUrl);
      if (dataUrl) {
        try {
          const imgType = dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
          doc.addImage(dataUrl, imgType, MARGIN, y, IMAGE_MAX_WIDTH, IMAGE_MAX_HEIGHT);
        } catch {
          // ignore
        }
      }
    }
  }

  // Remove the first blank page jsPDF adds by default (we use addPage for cover)
  if (pageCount > 0) {
    doc.deletePage(1);
  }

  report("Downloading...");
  doc.save(`${safeFilename}.pdf`);
}
