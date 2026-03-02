import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

export async function GET() {
  try {
    const publicDir = path.join(process.cwd(), "public");
    const { stdout } = await execFileAsync("zip", ["-r", "-", "chrome-plugin"], {
      cwd: publicDir,
      encoding: "buffer",
      maxBuffer: 20 * 1024 * 1024
    });

    return new NextResponse(stdout, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="chrome-plugin-extension.zip"',
        "Cache-Control": "no-store"
      }
    });
  } catch {
    return NextResponse.json({ error: "Failed to package chrome plugin." }, { status: 500 });
  }
}
