import { del } from "@vercel/blob";
import { createPartFromUri, GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 60;

const LANGUAGES: Record<string, string> = {
  auto: "the video's spoken language (auto-detect it)",
  en: "English",
  ta: "Tamil",
  hi: "Hindi",
  te: "Telugu",
  ml: "Malayalam",
  kn: "Kannada",
  bn: "Bengali",
  mr: "Marathi",
  gu: "Gujarati",
  pa: "Punjabi"
};

const captionSchema = {
  type: "object",
  properties: {
    segments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          start: { type: "number", description: "Start time in seconds." },
          end: { type: "number", description: "End time in seconds." },
          text: { type: "string", description: "Caption text in the requested language." }
        },
        required: ["start", "end", "text"]
      }
    }
  },
  required: ["segments"]
} as const;

const PROMPT = (targetLanguage: string, requestedLanguage: string) => `Create accurate synchronized subtitles for this video in ${targetLanguage}.
${requestedLanguage === "auto"
  ? "First detect the language actually spoken in the video and write the captions in that spoken language."
  : "Translate the spoken content into the requested language while preserving the meaning naturally."
}
Transcribe only spoken words. Split the transcript into natural caption-sized segments.
For every segment, provide start and end timestamps in seconds based on the video's timeline.
Do not invent speech. Keep names, numbers and technical terms accurate.
Return an empty segments array only when the video genuinely contains no understandable speech.`;

function parseSegments(raw: string) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const parsed = JSON.parse(cleaned || "{\"segments\":[]}");

  return Array.isArray(parsed.segments)
    ? parsed.segments
        .map((s: any) => ({
          start: Number(s.start),
          end: Number(s.end),
          text: String(s.text ?? "").trim()
        }))
        .filter((s: any) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start && s.text)
        .sort((a: any, b: any) => a.start - b.start)
    : [];
}

export async function POST(req: Request) {
  let blobUrl = "";
  let uploadedFileName = "";

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "GEMINI_API_KEY is not configured." }, { status: 500 });
    }

    const body = await req.json();
    blobUrl = String(body.videoUrl || "");
    const requestedLanguage = String(body.language || "en");
    const targetLanguage = LANGUAGES[requestedLanguage] || LANGUAGES.en;

    if (!blobUrl || !/^https:\/\/.+/.test(blobUrl)) {
      return Response.json({ error: "Uploaded video URL is required." }, { status: 400 });
    }

    const videoResponse = await fetch(blobUrl, { cache: "no-store" });
    if (!videoResponse.ok || !videoResponse.body) {
      throw new Error(`Could not retrieve uploaded video (HTTP ${videoResponse.status}).`);
    }

    const contentType = videoResponse.headers.get("content-type") || String(body.videoType || "video/mp4");
    if (!contentType.startsWith("video/")) {
      throw new Error("The uploaded object is not a valid video.");
    }

    const bytes = Buffer.from(await videoResponse.arrayBuffer());
    if (!bytes.byteLength) {
      throw new Error("The uploaded video is empty.");
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = PROMPT(targetLanguage, requestedLanguage);

    // The browser uploads directly to Vercel Blob, so this route never receives
    // the video as a request body. Gemini's Files API is used for every video.
    const uploaded = await ai.files.upload({
      file: new Blob([bytes], { type: contentType }),
      config: {
        mimeType: contentType,
        displayName: String(body.videoName || "captionai-video")
      }
    });

    if (!uploaded.name) {
      throw new Error("Gemini Files API did not return an uploaded file name.");
    }

    uploadedFileName = uploaded.name;
    let ready = uploaded;

    while (ready.state === "PROCESSING") {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      ready = await ai.files.get({ name: uploadedFileName });
    }

    if (ready.state !== "ACTIVE" || !ready.uri || !ready.mimeType) {
      throw new Error("Gemini video processing failed.");
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [createPartFromUri(ready.uri, ready.mimeType), prompt],
      config: {
        responseMimeType: "application/json",
        responseSchema: captionSchema
      }
    });

    const segments = parseSegments(response.text || "{\"segments\":[]}");

    return Response.json({
      language: requestedLanguage,
      text: segments.map((s: any) => s.text).join(" "),
      segments
    });
  } catch (error) {
    console.error("Gemini transcription error:", error);
    const message = error instanceof Error ? error.message : "Unknown Gemini error";
    return Response.json(
      { error: `Caption generation failed: ${message}` },
      { status: 500 }
    );
  } finally {
    if (uploadedFileName) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        const cleanupAi = new GoogleGenAI({ apiKey });
        await cleanupAi.files.delete({ name: uploadedFileName }).catch(() => undefined);
      }
    }
    if (blobUrl) {
      await del(blobUrl).catch(() => undefined);
    }
  }
}
