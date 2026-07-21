"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// recharts는 꽤 무거운 라이브러리라, 아직 학습 기록이 없어 차트를 안 그리는
// 사용자(신규 가입자 등)의 초기 로딩 JS에까지 그 무게를 지우지 않도록 클라이언트에서만,
// 그것도 실제로 렌더링될 때만 불러온다 (ssr:false는 클라이언트 컴포넌트 안에서만 허용된다).
export const StudyChartLazy = dynamic(() => import("./study-chart").then((m) => m.StudyChart), {
  ssr: false,
  loading: () => <Skeleton className="h-48 w-full" />,
});
