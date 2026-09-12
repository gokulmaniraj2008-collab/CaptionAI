import { handleUpload } from "@vercel/blob/client";

const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["video/*"],
        maximumSizeInBytes: MAX_VIDEO_BYTES,
        addRandomSuffix: true
      }),
      onUploadCompleted: async () => {
        // CaptionAI deletes temporary videos after Gemini finishes processing.
      }
    });

    return Response.json(jsonResponse);
  } catch (error) {
    console.error("Blob upload token error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Upload initialization failed." },
      { status: 500 }
    );
  }
}
