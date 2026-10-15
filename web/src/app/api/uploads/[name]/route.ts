import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  // Strict allow-list also blocks path traversal.
  const match = /^[a-f0-9-]{36}\.(jpg|png|webp)$/.exec(name);
  if (!match) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const dir = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
    const data = await readFile(path.join(dir, name));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": TYPES[match[1]],
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
