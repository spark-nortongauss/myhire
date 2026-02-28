import { NextResponse } from "next/server";
import { enforceOverdueRejections } from "@/lib/actions/overdue";

export async function POST() {
  await enforceOverdueRejections();
  return NextResponse.json({ ok: true });
}
