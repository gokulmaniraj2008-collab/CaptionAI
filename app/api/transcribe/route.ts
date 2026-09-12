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
  let uploadedFileName: string | undefined;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "GEMINI_API_KEY is not configured." }, { status: 500 });
    }

    const form = await req.formData();
    const video = form.get("video");
    const requestedLanguage = String(form.get("language") || "en");
    const targetLanguage = LANGUAGES[requestedLanguage] || LANGUAGES.en;

    if (!(video instanceof File)) {
      return Response.json({ error: "Video file is required." }, { status: 400 });
    }

    if (!video.type.startsWith("video/")) {
      return Response.json({ error: "Please upload a valid video file." }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = PROMPT(targetLanguage, requestedLanguage);
    const bytes = Buffer.from(await video.arrayBuffer());

    // Inline video input is intended for small requests. For larger videos,
    // use Gemini's Files API so the whole video is not embedded as base64.
    let response;
    if (bytes.byteLength <= 20 * 1024 * 1024) {
      response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [
          {
            inlineData: {
              mimeType: video.type || "video/mp4",
              data: bytes.toString("base64")
            }
          },
          { text: prompt }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: captionSchema
        }
      });
    } else {
      const uploaded = await ai.files.upload({
        file: new Blob([bytes], { type: video.type || "video/mp4" }),
        config: {
          mimeType: video.type || "video/mp4",
          displayName: video.name || "captionai-video"
        }
      });
      uploadedFileName = uploaded.name;

      let ready = uploaded;
      while (ready.state === "PROCESSING") {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        ready = await ai.files.get({ name: uploaded.name });
      }

      if (ready.state !== "ACTIVE" || !ready.uri || !ready.mimeType) {
        throw new Error("Gemini video processing failed.");
      }

      response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [createPartFromUri(ready.uri, ready.mimeType), prompt],
        config: {
          responseMimeType: "application/json",
          responseSchema: captionSchema
        }
      });
    }

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
  }
}