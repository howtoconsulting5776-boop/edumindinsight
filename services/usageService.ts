import { createSupabaseAdminClient } from "@/lib/supabase/server"

export type Plan = "free" | "pro" | "enterprise"
export type SignupMethod = "email" | "google" | "kakao"

const PLAN_LIMITS: Record<Plan, number | null> = {
  free: 10,
  pro: 150,
  enterprise: null,
}

/** plan별 월간 한도를 반환합니다. enterprise는 null(무제한). */
export function getPlanLimit(plan: Plan): number | null {
  return PLAN_LIMITS[plan]
}

/**
 * 특정 유저(analyzed_by)의 이번 달 counseling_logs 건수를 반환합니다.
 * academy_id 가 없는 계정의 fallback 한도 검사에 사용됩니다.
 */
export async function getMonthlyUsageCountByUser(userId: string): Promise<number> {
  const db = createSupabaseAdminClient()

  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const { count, error } = await db
    .from("counseling_logs")
    .select("*", { count: "exact", head: true })
    .eq("analyzed_by", userId)
    .gte("created_at", firstDay.toISOString())
    .lte("created_at", lastDay.toISOString())

  if (error) {
    throw new Error(`[usageService] getMonthlyUsageCountByUser failed: ${error.message}`)
  }

  return count ?? 0
}

/**
 * 해당 학원의 이번 달 counseling_logs 건수를 반환합니다.
 */
export async function getMonthlyUsageCount(academyId: string): Promise<number> {
  const db = createSupabaseAdminClient()

  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const { count, error } = await db
    .from("counseling_logs")
    .select("*", { count: "exact", head: true })
    .eq("academy_id", academyId)
    .gte("created_at", firstDay.toISOString())
    .lte("created_at", lastDay.toISOString())

  if (error) {
    // 에러를 상위로 전파 — analyze 라우트의 usage guard catch 블록이 처리
    throw new Error(`[usageService] getMonthlyUsageCount failed: ${error.message}`)
  }

  return count ?? 0
}

/**
 * 해당 학원의 이번 달 사용량 / 한도 / 잔여 횟수 / 사용률을 반환합니다.
 * enterprise 플랜은 limit, remaining 모두 null(무제한), percent = 0.
 */
export async function getRemainingUsage(
  academyId: string,
  plan: Plan
): Promise<{ used: number; limit: number | null; remaining: number | null; percent: number }> {
  const limit = PLAN_LIMITS[plan]
  const used = await getMonthlyUsageCount(academyId)

  if (plan === "enterprise" || limit === null) {
    return { used, limit: null, remaining: null, percent: 0 }
  }

  const remaining = limit - used
  const percent = Math.min(Math.round((used / limit) * 100), 100)

  return { used, limit, remaining, percent }
}
