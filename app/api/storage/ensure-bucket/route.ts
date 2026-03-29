import { NextResponse } from "next/server"
import { createSupabaseAdminClient, getUserProfile } from "@/lib/supabase/server"

export const runtime = "nodejs"

// pdf-uploads 버킷이 없으면 자동 생성
export async function POST() {
  try {
    const profile = await getUserProfile()
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = createSupabaseAdminClient()

    // 버킷 존재 여부 확인
    const { data: buckets, error: listErr } = await db.storage.listBuckets()
    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 500 })
    }

    const exists = (buckets ?? []).some((b) => b.name === "pdf-uploads")
    if (exists) {
      return NextResponse.json({ success: true, created: false })
    }

    // 버킷 생성
    const { error: createErr } = await db.storage.createBucket("pdf-uploads", {
      public: false,
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/heic",
        "image/heif",
      ],
    })

    if (createErr && !createErr.message?.includes("already exists")) {
      return NextResponse.json({ error: createErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, created: true })
  } catch (err) {
    console.error("[ensure-bucket]", err)
    return NextResponse.json({ error: "버킷 생성 실패" }, { status: 500 })
  }
}
