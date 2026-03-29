import { NextRequest, NextResponse } from "next/server"
import { validateCredentials, setSession } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json({ error: "아이디와 비밀번호를 입력해주세요." }, { status: 400 })
    }

    const role = validateCredentials(username, password)
    if (!role) {
      return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 })
    }

    await setSession({ role, username })
    return NextResponse.json({ role, username })
  } catch {
    return NextResponse.json({ error: "로그인 처리 중 오류가 발생했습니다." }, { status: 500 })
  }
}
