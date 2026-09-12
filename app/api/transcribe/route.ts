import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 60;

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
          text: { type: "string", description: "Exact spoken English words for this segment." }
        },
        required: ["start", "end", "text"]
      }
    }
  },
  required: ["segments"]
} as const;

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "GEMINI_API_KEY is not configured." }, { status: 500 });
    }

    const form = await req.formData();
    const video = form.get("video");
    if (!(video instanceof File)) {
      return Response.json({ error: "Video file is required." }, { status: 400 });
    }

    if (!video.type.startsWith("video/")) {
      return Response.json({ error: "Please upload a valid video file." }, { status: 400 });
    }

    const bytes = Buffer.from(await video.arrayBuffer());
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          inlineData: {
            mimeType: video.type || "video/mp4",
            data: bytes.toString("base64")
          }
        },
        {
          text: `Create accurate English subtitles for this video. Transcribe only spoken words, preserving the actual wording. Split the transcript into natural caption-sized segments. For every segment, provide start and end timestamps in seconds based on the video's timeline. Do not invent speech. If there is no speech, return an empty segments array.`
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: captionSchema
      }
    });

    const parsed = JSON.parse(response.text || "{\"segments\":[]}");
    const segments = Array.isArray(parsed.segments)
      ? parsed.segments
          .map((s: any) => ({
            start: Number(s.start),
            end: Number(s.end),
            text: String(s.text ?? "").trim()
          }))
          .filter((s: any) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start && s.text)
          .sort((a: any, b: any) => a.start - b.start)
      : [];

    return Response.json({
      text: segments.map((s: any) => s.text).join(" "),
      segments
    });
  } catch (error) {
    console.error("Gemini transcription error:", error);
    return Response.json({ error: "Gemini could not create captions for this video." }, { status: 500 });
  }
}