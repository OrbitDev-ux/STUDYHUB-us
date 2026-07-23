export type DeveloperAuditCatalogEntry = {
  action: string;
  label: string;
  recordedWhen: string;
  target: string;
  detailFields: string;
  verify: string;
  recovery: string;
};

export const DEVELOPER_AUDIT_CATALOG: DeveloperAuditCatalogEntry[] = [
  { action: "developer.login", label: "개발자 특별 로그인", recordedWhen: "Admin 또는 Super Admin 역할과 특별 로그인 코드 검증 후 콘솔 세션 생성 시", target: "session / -", detailFields: "request.ip, request.userAgent", verify: "동일 시각의 관리자 계정과 접속 기기 확인", recovery: "의심 로그인이라면 세션 종료, 비밀번호·접근 코드 교체" },
  { action: "developer.logout", label: "개발자 로그아웃", recordedWhen: "개발자 세션 쿠키 삭제와 Supabase 로그아웃 직전", target: "session / -", detailFields: "request.ip, request.userAgent", verify: "로그인 이후 정상 종료 여부와 세션 시간 비교", recovery: "후속 복구 없음. 미로그아웃 세션은 비밀번호 교체로 무효화 검토" },
  { action: "question.create", label: "문제 생성", recordedWhen: "새 문제 DB 저장 성공 후", target: "question / 문제 UUID", detailFields: "status, request", verify: "Questions에서 문제 UUID·학년·과목·상태 확인", recovery: "Draft/Archived 전환. 공개 전이면 삭제보다 보관 권장" },
  { action: "question.update", label: "문제 내용 수정", recordedWhen: "기존 문제의 문항·보기·정답·해설 저장 성공 후", target: "question / 문제 UUID", detailFields: "status, request", verify: "정답·해설 재검수 및 상태 확인", recovery: "이전 원문이 로그에 저장되지는 않으므로 백업 또는 수동 재수정" },
  { action: "question.draft", label: "문제 Draft 전환", recordedWhen: "문제 상태를 Draft로 변경한 후", target: "question / 문제 UUID", detailFields: "request", verify: "일반 문제 선택 대상에서 제외됐는지 확인", recovery: "검수 후 question.published 실행" },
  { action: "question.published", label: "문제 공개", recordedWhen: "문제를 Published로 전환한 후", target: "question / 문제 UUID", detailFields: "request", verify: "학년·과목·정답·해설과 공개 목록 확인", recovery: "오류가 있으면 즉시 Draft 또는 Archived 전환" },
  { action: "question.archived", label: "문제 보관", recordedWhen: "문제를 Archived로 전환한 후", target: "question / 문제 UUID", detailFields: "request", verify: "연습·신규 대회 선택에서 제외됐는지 확인", recovery: "필요하면 Draft로 복원 후 재검수" },
  { action: "contest.create", label: "대회 생성", recordedWhen: "대회와 문제 목록 저장 성공 후", target: "contest / 대회 UUID", detailFields: "publicationStatus, isRated, questionCount, request", verify: "대회명·대상·시간·문제 수·Rated 여부 확인", recovery: "시작 전 Draft/Cancelled 전환 또는 설정 수정" },
  { action: "contest.draft", label: "대회 Draft 전환", recordedWhen: "대회 공개 상태를 Draft로 변경한 후", target: "contest / 대회 UUID", detailFields: "request", verify: "일반 사용자 목록에서 숨겨졌는지 확인", recovery: "검수 후 contest.published 실행" },
  { action: "contest.published", label: "대회 공개", recordedWhen: "대회 상태를 Published로 변경한 후", target: "contest / 대회 UUID", detailFields: "request", verify: "대상 사용자 목록 노출과 참가 조건 확인", recovery: "시작 전 Draft 또는 Cancelled 전환" },
  { action: "contest.cancelled", label: "대회 취소", recordedWhen: "대회 상태를 Cancelled로 변경한 후", target: "contest / 대회 UUID", detailFields: "request", verify: "사용자 노출·진입 차단과 취소 공지 확인", recovery: "정책상 가능할 때 Published로 재전환하고 별도 정정 공지" },
  { action: "contest.finish", label: "대회 종료·정산", recordedWhen: "종료 시각 변경 후 Rating 정산 함수 호출 전", target: "contest / 대회 UUID", detailFields: "request", verify: "리더보드, contest_rating_changes, 참가자 Rating History 확인", recovery: "재실행 금지. 오류 참가자는 원기록 계산 후 rating.adjust로 개별 보정" },
  { action: "user.update", label: "사용자 플랜·설정 변경", recordedWhen: "profiles의 plan과 사용자 설정 저장 성공 후", target: "user / 사용자 UUID", detailFields: "role, plan, roleChanged, request", verify: "Users와 대상 프로필의 플랜·설정 확인", recovery: "원래 값으로 재설정하고 정정 사유 기록" },
  { action: "user.role.update", label: "사용자 운영 역할 변경", recordedWhen: "Super Admin이 안전 RPC로 User·Admin·Super Admin 역할을 변경한 후", target: "user / 사용자 UUID", detailFields: "roleBefore, roleAfter, reason, request", verify: "Users의 역할 배지, 대상 사용자 알림, 개발자 콘솔 접근 권한 확인", recovery: "다른 Super Admin이 근거를 확인한 뒤 이전 역할로 재설정. 마지막 Super Admin과 현재 계정 자기 강등은 차단됨" },
  { action: "rating.adjust", label: "Rating 수동 조정", recordedWhen: "안전 RPC 또는 호환 경로로 Rating과 알림 저장 후", target: "user / 사용자 UUID", detailFields: "rating, reason, request", verify: "사용자 알림, Dashboard 그래프, 전체 순위 확인", recovery: "원본 이벤트를 다시 계산한 목표 Rating으로 재조정. 이전 로그 삭제 금지" },
  { action: "rating.history.delete", label: "Rating 이벤트 삭제·재계산", recordedWhen: "선택 이벤트 삭제와 이후 History·현재·최고 Rating 재계산이 한 트랜잭션으로 완료된 후", target: "rating_history / 삭제된 이벤트 UUID", detailFields: "userId, nickname, deletedEvent, ratingBefore, ratingAfter, peakAfter, ratedEventsAfter, reason, request", verify: "Rating Events에서 원본 미노출, 사용자 Dashboard·상세 History·그래프·전체 순위·알림 확인", recovery: "삭제 이벤트 전체 스냅샷은 이 감사 로그에 보존됩니다. 오삭제 시 스냅샷을 근거로 Users에서 Rating을 조정하고 별도 정정 사유를 기록" },
  { action: "notification.broadcast", label: "대량·대상 공지 발송", recordedWhen: "선택된 모든 수신자의 알림 생성 완료 후", target: "notification / -", detailFields: "title, audience, gradeLevel, targetUserId, recipientCount, request", verify: "성공 수신자 수와 테스트 계정 알림 확인", recovery: "일괄 회수 불가. 잘못된 내용을 명시한 정정 공지 발송" },
  { action: "forum.pin", label: "포럼 게시글 고정", recordedWhen: "게시글 pinned=true 저장 및 작성자 알림 후", target: "forum_post / 게시글 UUID", detailFields: "title, request", verify: "포럼 최상단 고정 여부 확인", recovery: "forum.unpin 실행" },
  { action: "forum.unpin", label: "포럼 게시글 고정 해제", recordedWhen: "게시글 pinned=false 저장 및 작성자 알림 후", target: "forum_post / 게시글 UUID", detailFields: "title, request", verify: "일반 작성일 순서로 이동했는지 확인", recovery: "필요하면 forum.pin 재실행" },
  { action: "forum.announcement.create", label: "관리자 중요 공지 게시", recordedWhen: "관리자 글을 공지로 저장·상단 고정하고 전체 사용자 알림을 생성한 후", target: "forum_post / 공지 UUID", detailFields: "title, category, pinned, notificationAudience, compatibilityMode, request", verify: "포럼 최상단 중요 공지 표시와 테스트 계정 실시간 알림 확인", recovery: "내용 오류 시 게시글을 삭제하고 정정 중요 공지를 새로 게시. 전체 발송 알림은 일괄 회수되지 않음" },
  { action: "forum.delete", label: "포럼 게시글 삭제", recordedWhen: "게시글과 연결 댓글·좋아요 삭제 후", target: "forum_post / 삭제된 게시글 UUID", detailFields: "title, category, reason, ownerId, request", verify: "포럼 목록 미노출과 작성자 사유 알림 확인", recovery: "애플리케이션에서 복구 불가. DB 백업이 있을 때만 별도 복원 검토" },
  { action: "chat.report.review_start", label: "채팅 신고 검토 시작", recordedWhen: "Pending 신고를 Reviewing으로 전환한 후", target: "message_report / 신고 UUID", detailFields: "reportedUserId, category, request", verify: "신고 상태와 검토 대상 사용자를 확인", recovery: "최종 resolved 또는 dismissed 처리로 검토 종료" },
  { action: "chat.report.resolve", label: "채팅 신고 최종 처리", recordedWhen: "신고 상태·판단 근거·경고/제한 저장과 사용자 알림 후", target: "message_report / 신고 UUID", detailFields: "status, category, reportedUserId, moderationAction, restrictedUntil, resolution, request", verify: "신고자 결과 알림, 대상 조치 알림, 제한 상태 확인", recovery: "오판이면 chat.restriction.lift 후 정정 알림. 신고 원기록은 유지" },
  { action: "chat.restriction.lift", label: "채팅 제한 해제", recordedWhen: "chat_restrictions 삭제와 대상 사용자 알림 후", target: "user / 사용자 UUID", detailFields: "reason, request", verify: "현재 제한 목록 제외 및 메시지 전송 가능 여부 확인", recovery: "새 근거가 있으면 신고 처리 절차를 통해 다시 제한" },
  { action: "system.maintenance", label: "서비스 점검 모드 변경", recordedWhen: "점검 모드·안내문 저장과 외부 알림 후", target: "system / -", detailFields: "enabled, message, request", verify: "일반 계정은 /maintenance, 개발자 콘솔은 정상 접근하는지 확인", recovery: "원인 해결과 검증 후 enabled=false로 저장" },
  { action: "audit.update", label: "감사 로그 수정", recordedWhen: "Super Admin이 감사 로그 필드를 수정하고 변경 전·후 스냅샷을 개정 이력에 저장한 후", target: "audit_log / 원본 로그 UUID", detailFields: "reason, originalAction, updatedAction, revisionPreserved", verify: "원본 로그의 Edited 표시와 개정 이력의 before/after 스냅샷 확인", recovery: "개정 이력의 이전 스냅샷을 근거로 다시 수정하고 복구 사유 기록" },
  { action: "audit.archive", label: "감사 로그 보관", recordedWhen: "Super Admin이 감사 로그를 기본 목록에서 숨기고 원본 스냅샷을 보존한 후", target: "audit_log / 원본 로그 UUID", detailFields: "reason, affectedAction, revisionPreserved", verify: "활성 목록 미노출, 보관 로그 필터 노출, archive 개정 이력 확인", recovery: "근거 확인 후 audit.restore 실행" },
  { action: "audit.restore", label: "감사 로그 복원", recordedWhen: "Super Admin이 보관된 감사 로그를 활성 목록으로 복원한 후", target: "audit_log / 원본 로그 UUID", detailFields: "reason, affectedAction, revisionPreserved", verify: "활성 목록 재노출과 restore 개정 이력 확인", recovery: "오복원이면 새 사유로 다시 보관" },
];

export const DEVELOPER_AUDIT_ACTIONS = DEVELOPER_AUDIT_CATALOG.map((entry) => entry.action);
