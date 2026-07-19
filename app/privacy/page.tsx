import Link from "next/link";

export const metadata = { title: "개인정보처리방침" };

const EFFECTIVE_DATE = "2026-07-19";

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12 sm:py-16">
      <div className="flex flex-col gap-2">
        <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          ← StudyHub 홈으로
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">개인정보처리방침</h1>
        <p className="text-sm text-muted-foreground">시행일: {EFFECTIVE_DATE}</p>
      </div>

      <div className="flex flex-col gap-8 text-sm leading-relaxed text-foreground [&_h2]:mt-2 [&_h2]:text-base [&_h2]:font-semibold [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
        <section>
          <p>
            주식회사 Syntax Studio(이하 &ldquo;회사&rdquo;)가 운영하는 StudyHub(이하 &ldquo;서비스&rdquo;)는
            이용자의 개인정보를 중요하게 생각하며, 「개인정보 보호법」 등 관련 법령을 준수합니다. 회사는 본
            개인정보처리방침을 통해 이용자가 제공하는 개인정보가 어떠한 목적과 방식으로 이용되고 있으며, 개인정보
            보호를 위해 어떠한 조치가 취해지고 있는지 안내합니다.
          </p>
        </section>

        <section>
          <h2>1. 수집하는 개인정보 항목</h2>
          <p>회사는 회원가입, 서비스 제공, 상담 처리 등을 위해 아래와 같은 개인정보를 수집합니다.</p>
          <ul>
            <li>필수 항목: 이메일 주소, 비밀번호(암호화 저장), 닉네임</li>
            <li>서비스 이용 과정에서 생성되는 정보: 학년, 목표 학습시간, 목표 성적, 시험일, 진단평가 결과, 학습·숙제 기록, 학습 시간, XP·레벨·배지 등 게임화 데이터</li>
            <li>소셜 로그인 이용 시: Google/Discord 계정의 식별자, 이메일, 닉네임(각 서비스의 동의 범위 내)</li>
            <li>Discord 연동 이용 시: Discord 사용자 ID, Discord 닉네임</li>
            <li>자동 수집 정보: 접속 로그, 쿠키, 서비스 이용 기록</li>
          </ul>
        </section>

        <section>
          <h2>2. 개인정보의 수집 및 이용 목적</h2>
          <ul>
            <li>회원 가입 의사 확인, 회원제 서비스 제공에 따른 본인 식별·인증</li>
            <li>AI 기반 진단평가, 맞춤형 숙제·학습 플래너·피드백 생성 및 제공</li>
            <li>학습 기록 기반 통계 제공, 랭킹·배지 등 게임화 요소 운영</li>
            <li>유료 플랜(Basic/Pro) 가입 여부 확인 및 관리, Discord 프리미엄 역할 연동</li>
            <li>공지사항 전달, 불만 처리 등 민원 처리, 서비스 점검 안내</li>
          </ul>
        </section>

        <section>
          <h2>3. 개인정보의 보유 및 이용기간</h2>
          <p>
            회사는 원칙적으로 이용자의 개인정보를 회원 탈퇴 시 지체 없이 파기합니다. 다만 관계 법령에 따라 보존할
            필요가 있는 경우 회사는 관계 법령에서 정한 일정한 기간 동안 회원정보를 보관합니다. 학습 기록 등 서비스
            이용 과정에서 생성된 데이터는 계정 삭제 요청 시 함께 삭제됩니다.
          </p>
        </section>

        <section>
          <h2>4. 개인정보의 제3자 제공 및 처리위탁</h2>
          <p>
            회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않으며, 서비스 제공을 위해 아래와 같이 처리를
            위탁하고 있습니다.
          </p>
          <ul>
            <li>Supabase (인프라·데이터베이스 및 인증 호스팅)</li>
            <li>Anthropic 또는 Z.ai(GLM) — AI 진단평가·숙제·학습 플래너·피드백 생성을 위한 학습 데이터 처리</li>
            <li>Discord — 소셜 로그인 및 계정 연동, 알림 DM 발송(연동 및 알림을 설정한 이용자에 한함)</li>
            <li>Google — 소셜 로그인(이용자가 선택한 경우)</li>
          </ul>
          <p>
            위 수탁업체는 위탁받은 목적 범위를 초과하여 개인정보를 이용하지 않으며, 서비스 개선 및 운영 안정성
            확보를 위해 필요한 경우 위탁 대상은 변경될 수 있고, 변경 시 본 방침을 통해 고지합니다.
          </p>
        </section>

        <section>
          <h2>5. 만 14세 미만 아동의 개인정보 처리</h2>
          <p>
            서비스는 초등학생부터 고등학생까지 폭넓은 학년을 대상으로 제공됩니다. 만 14세 미만 아동의 개인정보를
            수집·이용하는 경우 「개인정보 보호법」에 따라 법정대리인의 동의가 필요할 수 있습니다. 만 14세 미만
            아동이 법정대리인의 동의 없이 가입한 사실이 확인되는 경우, 회사는 관련 법령에 따라 필요한 조치를 취할
            수 있습니다. 자녀가 서비스를 이용 중인 법정대리인은 언제든지 아래 문의처를 통해 자녀의 개인정보 열람,
            정정, 삭제 및 동의 철회를 요청할 수 있습니다.
          </p>
        </section>

        <section>
          <h2>6. 이용자의 권리와 행사방법</h2>
          <p>
            이용자는 언제든지 자신의 개인정보를 조회하거나 수정할 수 있으며, 회원 탈퇴를 통해 개인정보 수집·이용에
            대한 동의를 철회할 수 있습니다. 개인정보 열람, 정정, 삭제, 처리정지를 요청하고자 하는 경우 아래
            문의처로 연락해 주시면 지체 없이 조치하겠습니다.
          </p>
        </section>

        <section>
          <h2>7. 개인정보의 파기절차 및 방법</h2>
          <p>
            이용자가 입력한 개인정보는 목적이 달성된 후 별도의 DB로 옮겨져(종이의 경우 별도의 서류함) 내부 방침 및
            기타 관련 법령에 의한 정보보호 사유에 따라 일정 기간 저장된 후 파기됩니다. 전자적 파일 형태로 저장된
            개인정보는 기록을 복구할 수 없는 기술적 방법을 사용하여 삭제합니다.
          </p>
        </section>

        <section>
          <h2>8. 쿠키의 사용</h2>
          <p>
            서비스는 로그인 상태 유지, 언어·테마 설정 기억 등을 위해 쿠키를 사용합니다. 이용자는 브라우저 설정을
            통해 쿠키 저장을 거부할 수 있으나, 이 경우 서비스 이용에 제약이 있을 수 있습니다.
          </p>
        </section>

        <section>
          <h2>9. 개인정보 보호책임자</h2>
          <p>
            회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 이용자의 불만처리 및
            피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
          </p>
          <ul>
            <li>회사명: 주식회사 Syntax Studio</li>
            <li>문의 이메일: [개인정보 보호책임자 이메일 입력]</li>
          </ul>
        </section>

        <section>
          <h2>10. 고지의 의무</h2>
          <p>
            본 개인정보처리방침의 내용이 추가, 삭제 및 수정이 있을 경우 개정 최소 7일 전부터 서비스 내 공지사항을
            통하여 고지할 것입니다.
          </p>
        </section>

        <section className="border-t border-border pt-6 text-xs text-muted-foreground">
          <p>
            본 방침은 일반적인 서비스 운영을 기준으로 작성된 초안이며, 실제 시행 전 관련 법률 전문가의 검토를
            받으시길 권장합니다.
          </p>
        </section>
      </div>
    </main>
  );
}
