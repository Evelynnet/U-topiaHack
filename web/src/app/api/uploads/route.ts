import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Token endpoint for direct browser -> Vercel Blob uploads (files never pass through
 * this function, so Vercel's ~4.5 MB request limit doesn't apply).
 *
 * This route is also called by Vercel Blob itself when an upload finishes; that call has
 * no user cookie, which is why authentication lives inside onBeforeGenerateToken only.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await getSession();
        if (!session) throw new Error("unauthorized");
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: session.userId }),
        };
      },
      onUploadCompleted: async () => {
        // Nothing to do: the listing form sends the blob URLs along with the listing.
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    const unauthorized = err instanceof Error && err.message === "unauthorized";
    return NextResponse.json(
      { error: unauthorized ? "unauthorized" : "upload_failed" },
      { status: unauthorized ? 401 : 400 },
    );
  }
}
