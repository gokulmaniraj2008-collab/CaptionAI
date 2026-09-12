import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "OPENAI_API_KEY is not configured." }, { status: 500 });
    }

    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File)) {
      return Response.json({ error: "Audio file is required." }, { status: 400 });
    }

    const client = new OpenAI({ apiKey });
    const result = await client.audio.transcriptions.create({
      file: audio,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
      language: "en"
    });

    const segments = (result as any).segments ?? [];
    return Response.json({
      text: (result as any).text ?? "",
      segments: segments.map((s: any) => ({
        start: Number(s.start) || 0,
        end: Number(s.end) || 0,
        text: String(s.text ?? "").trim()
      }))
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Transcription failed." }, { status: 500 });
  }
}