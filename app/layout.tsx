import type { Metadata } from "next";
import { Geist, Geist_Mono, Figtree } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";

const figtree = Figtree({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://edumindinsight-lwsi.vercel.app"),
  title: {
    default: "에듀마인 인사이트 | AI 기반 학원 상담 감정 분석 솔루션",
    template: "%s | 에듀마인 인사이트",
  },
  description:
    "학부모 상담의 행간을 읽고 퇴원 징후를 조기에 포착하세요. AI 기반 RAG 기술로 우리 학원만의 상담 원칙을 학습시킨 스마트한 상담 파트너입니다.",
  keywords: [
    "학원 상담 분석",
    "감정 분석 AI",
    "퇴원 방어",
    "에듀마인 인사이트",
    "학원 관리 솔루션",
    "학부모 상담 전략",
  ],
  authors: [{ name: "Jang Eui-woong" }],
  openGraph: {
    title: "에듀마인 인사이트 - 데이터로 증명하는 상담의 가치",
    description:
      "학부모의 숨은 의도를 분석하고 우리 학원 맞춤형 대응 스크립트를 생성합니다.",
    siteName: "EduMind Insight",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "에듀마인 인사이트 서비스 화면",
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "에듀마인 인사이트 | 학원 전용 AI 상담 분석기",
    description: "AI가 분석하는 학부모의 진심, 이제 상담의 주도권을 잡으세요.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/logo.png",
    apple: "/apple-touch-icon.png",
    shortcut: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", figtree.variable)}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
