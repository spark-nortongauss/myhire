import { NextResponse } from "next/server";

// Retired: elapsed time is a follow-up signal, never proof of rejection.
export async function POST() {
  return NextResponse.json({ error: "Automatic rejection is disabled. Update application statuses explicitly." }, { status: 410 });
}
