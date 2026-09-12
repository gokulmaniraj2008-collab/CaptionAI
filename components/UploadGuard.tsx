"use client";

import { useEffect } from "react";

const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_VIDEO_LABEL = "2 GB";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function UploadGuard() {
  useEffect(() => {
    const updateInfo = (input: HTMLInputElement, message: string, error = false) => {
      const drop = input.closest(".drop");
      if (!drop) return;

      let info = drop.querySelector<HTMLDivElement>("[data-upload-limit-info]");
      if (!info) {
        info = document.createElement("div");
        info.dataset.uploadLimitInfo = "true";
        info.style.marginTop = "12px";
        info.style.fontSize = "12px";
        info.style.lineHeight = "1.5";
        info.style.fontWeight = "600";
        drop.appendChild(info);
      }
      info.textContent = message;
      info.style.color = error ? "#b42318" : "#475467";
    };

    const onChange = (event: Event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "file" || input.accept !== "video/*") return;

      const file = input.files?.[0];
      if (!file) return;

      if (file.size > MAX_VIDEO_BYTES) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        updateInfo(
          input,
          `Rejected: ${formatBytes(file.size)}. CaptionAI free tier supports videos up to ${MAX_VIDEO_LABEL} per video.`,
          true
        );
        input.value = "";
        return;
      }

      updateInfo(
        input,
        `Selected: ${file.name} (${formatBytes(file.size)}) • Max ${MAX_VIDEO_LABEL}/video • Gemini Free tier`,
        false
      );
    };

    document.addEventListener("change", onChange, true);

    return () => document.removeEventListener("change", onChange, true);
  }, []);

  return (
    <div
      aria-label="CaptionAI upload limits"
      style={{
        position: "fixed",
        left: "12px",
        bottom: "12px",
        zIndex: 50,
        maxWidth: "min(420px, calc(100vw - 24px))",
        padding: "10px 12px",
        border: "1px solid rgba(16,24,40,.12)",
        borderRadius: "12px",
        background: "rgba(255,255,255,.96)",
        boxShadow: "0 6px 24px rgba(16,24,40,.10)",
        color: "#344054",
        fontSize: "11px",
        lineHeight: 1.45
      }}
    >
      <strong>Free limits:</strong> 2 GB/video • Gemini File API • Quotas vary by model/project.
      <br />
      <span>Large videos use direct Vercel Blob upload; Gemini still enforces its own limits.</span>
    </div>
  );
}
