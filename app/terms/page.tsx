import Link from "next/link";

export const metadata = { title: "이용약관" };

const EFFECTIVE_DATE = "2026-07-19";

export default function TermsPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12 sm:py-16">
      <div className="flex flex-col gap-2">
        <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          ← StudyHub 홈으로
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">이용약관</h1>
        <p className="text-sm text-muted-foreground">시행일: {EFFECTIVE_DATE}</p>
      </div>

      <div className="flex flex-col gap-8 text-sm leading-relaxed text-foreground [&_h2]:mt-2 [&_h2]:text-base [&_h2]:font-semibold [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
        <section>
          <h2>제1조 (목적)</h2>
          <p>
            본 약관은 주식회사 Syntax Studio(이하 &ldquo;회사&rdquo;)가 제공하는 AI 학습 코칭 서비스
            StudyHub(이하 &ldquo;서비스&rdquo;)의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항, 기타
            필요한 사항을 규정함을 목적으로 합니다.
          </p>
        </section>

        <section>
          <h2>제2조 (정의)</h2>
          <ul>
            <li>&ldquo;이용자&rdquo;란 본 약관에 따라 회사가 제공하는 서비스를 이용하는 회원을 말합니다.</li>
            <li>
              &ldquo;회원&rdquo;이란 서비스에 개인정보를 제공하여 회원가입을 한 자로서, 서비스가 제공하는 정보를
              지속적으로 제공받으며 서비스를 이용할 수 있는 자를 말합니다.
            </li>
            <li>&ldquo;콘텐츠&rdquo;란 서비스가 AI를 통해 자동 생성하는 진단평가, 숙제, 학습 플래너, 피드백 등을 말합니다.</li>
          </ul>
        </section>

        <section>
          <h2>제3조 (약관의 효력 및 변경)</h2>
          <p>
            본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다. 회사는
            관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있으며, 개정 시 적용일자 및 개정사유를 명시하여
            현행 약관과 함께 적용일자 최소 7일 전(이용자에게 불리한 변경의 경우 30일 전)부터 공지합니다.
          </p>
        </section>

        <section>
          <h2>제4조 (이용계약의 체결)</h2>
          <p>
            이용계약은 이용자가 본 약관 및 개인정보처리방침에 동의하고 회원가입을 신청한 후, 회사가 이를 승낙함으로써
            체결됩니다. 만 14세 미만 아동은 법정대리인의 동의를 얻어 가입하여야 하며, 회사는 필요한 경우 법정대리인의
            동의 여부를 확인할 수 있습니다.
          </p>
        </section>

        <section>
          <h2>제5조 (서비스의 제공 및 변경)</h2>
          <p>회사는 이용자에게 아래와 같은 서비스를 제공합니다.</p>
          <ul>
            <li>AI 기반 실력 진단평가 및 예상 등급 산출</li>
            <li>취약 단원 분석 및 맞춤형 숙제·학습 플래너 자동 생성</li>
            <li>포모도로 타이머, 오답노트, 일일 AI 피드백</li>
            <li>XP·레벨·배지·랭킹 등 게임화 요소</li>
          </ul>
          <p>
            서비스가 AI를 통해 생성하는 콘텐츠(문제, 해설, 학습 계획, 피드백 등)는 학습 보조를 위한 참고 자료이며,
            그 정확성이나 완전성을 보증하지 않습니다. 이용자는 AI 생성 콘텐츠에 오류가 있을 수 있음을 이해하고
            이용하여야 합니다.
          </p>
        </section>

        <section>
          <h2>제6조 (서비스의 중단)</h2>
          <p>
            회사는 시스템 점검, 교체, 고장, 통신 두절 또는 운영상 상당한 이유가 있는 경우 서비스 제공을 일시적으로
            중단할 수 있으며, 사전에 공지하는 것을 원칙으로 합니다. 다만 긴급한 경우 사후에 공지할 수 있습니다.
          </p>
        </section>

        <section>
          <h2>제7조 (유료 서비스)</h2>
          <p>
            회사는 Free, Basic, Pro 등급의 플랜을 운영하며, 등급별로 숙제 문제 수, AI 리포트 보관 기간 등 이용
            범위에 차이가 있을 수 있습니다. 유료 플랜 전환은 현재 관리자가 결제 확인 후 수동으로 반영하는 방식으로
            운영되며, 구체적인 결제·환불 절차는 별도 안내를 따릅니다.
          </p>
        </section>

        <section>
          <h2>제8조 (회원의 의무)</h2>
          <ul>
            <li>이용자는 회원가입 시 사실에 근거하여 정보를 제공해야 하며, 타인의 정보를 도용해서는 안 됩니다.</li>
            <li>이용자는 자신의 계정 정보를 제3자에게 제공하거나 공유해서는 안 됩니다.</li>
            <li>이용자는 서비스를 이용하여 얻은 정보를 회사의 사전 승낙 없이 복제, 유통, 상업적으로 이용할 수 없습니다.</li>
            <li>이용자는 서비스의 정상적인 운영을 방해하는 행위(부정한 방법의 XP·배지 획득 시도 등)를 해서는 안 됩니다.</li>
          </ul>
        </section>

        <section>
          <h2>제9조 (회사의 의무)</h2>
          <p>
            회사는 관련 법령과 본 약관이 금지하는 행위를 하지 않으며, 계속적이고 안정적인 서비스 제공을 위해
            최선을 다합니다. 회사는 이용자의 개인정보를 개인정보처리방침에 따라 보호합니다.
          </p>
        </section>

        <section>
          <h2>제10조 (계약 해지 및 이용제한)</h2>
          <p>
            이용자는 언제든지 설정 메뉴 또는 고객센터를 통해 이용계약 해지(회원탈퇴)를 요청할 수 있으며, 회사는
            관련 법령이 정하는 바에 따라 이를 즉시 처리합니다. 이용자가 본 약관을 위반한 경우 회사는 사전 통지 후
            서비스 이용을 제한하거나 이용계약을 해지할 수 있습니다.
          </p>
        </section>

        <section>
          <h2>제11조 (지적재산권)</h2>
          <p>
            서비스 내에서 회사가 제작한 콘텐츠 및 소프트웨어에 대한 저작권과 기타 지적재산권은 회사에 귀속됩니다.
            이용자는 서비스를 이용함으로써 얻은 정보를 회사의 사전 승낙 없이 복제, 전송, 출판, 배포, 방송 등의
            방법으로 이용하거나 제3자에게 이용하게 해서는 안 됩니다.
          </p>
        </section>

        <section>
          <h2>제12조 (면책조항)</h2>
          <p>
            회사는 천재지변, 전쟁 및 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우 책임이
            면제됩니다. 회사는 AI가 생성한 콘텐츠의 오류로 인해 발생한 손해에 대해 고의 또는 중대한 과실이 없는 한
            책임을 지지 않으며, 서비스는 정규 교육을 대체하지 않는 학습 보조 도구임을 안내합니다.
          </p>
        </section>

        <section>
          <h2>제13조 (분쟁해결 및 준거법)</h2>
          <p>
            본 약관과 관련하여 회사와 이용자 간에 발생한 분쟁에 대해서는 대한민국 법을 준거법으로 하며, 관련
            법령에 정한 절차에 따른 관할 법원에 소를 제기할 수 있습니다.
          </p>
        </section>

        <section className="border-t border-border pt-6 text-xs text-muted-foreground">
          <p>
            본 약관은 일반적인 서비스 운영을 기준으로 작성된 초안이며, 실제 시행 전 관련 법률 전문가의 검토를
            받으시길 권장합니다.
          </p>
        </section>
      </div>
    </main>
  );
}
