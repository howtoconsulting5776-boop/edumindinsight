import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "에듀마인 인사이트 - 데이터로 증명하는 상담의 가치"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #3E2D9B 0%, #5A44C4 50%, #2D1F7A 100%)",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* 배경 장식 원 */}
        <div
          style={{
            position: "absolute",
            top: -120,
            left: -120,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -100,
            right: -80,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.05)",
          }}
        />

        {/* 로고 + 서비스명 */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 40 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: "rgba(255,255,255,0.15)",
              border: "2px solid rgba(255,255,255,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 800,
              color: "white",
            }}
          >
            EI
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 18, letterSpacing: 4 }}>
              EduMind Insight
            </span>
            <span style={{ color: "white", fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>
              에듀마인 인사이트
            </span>
          </div>
        </div>

        {/* 메인 헤드라인 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 0,
          }}
        >
          <span
            style={{
              color: "white",
              fontSize: 62,
              fontWeight: 800,
              lineHeight: 1.25,
              letterSpacing: -1,
            }}
          >
            상담의 데이터화,
          </span>
          <span
            style={{
              color: "white",
              fontSize: 62,
              fontWeight: 800,
              lineHeight: 1.25,
              letterSpacing: -1,
            }}
          >
            학원의 자산이 됩니다
          </span>
        </div>

        {/* 서브 텍스트 */}
        <p
          style={{
            color: "rgba(255,255,255,0.65)",
            fontSize: 24,
            marginTop: 28,
            textAlign: "center",
          }}
        >
          AI 기반 학부모 상담 감정 분석으로 이탈을 방지하고 신뢰를 쌓으세요.
        </p>

        {/* 하단 URL */}
        <div
          style={{
            position: "absolute",
            bottom: 36,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,0.12)",
            borderRadius: 50,
            padding: "10px 24px",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 18 }}>
            edumindinsight-lwsi.vercel.app
          </span>
        </div>
      </div>
    ),
    { ...size }
  )
}
