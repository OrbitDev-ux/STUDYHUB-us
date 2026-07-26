# CLAUDE.md

# 🤖 CLAUDE.md

> Internal development guide for Claude and AI coding assistants.
>
> Project: **StudyHub**
>
> Company: **Syntax Studio**

---

# 프로젝트 소개

StudyHub는 학생들을 위한 현대적인 스터디 커뮤니티 플랫폼입니다.

사용자는 스터디를 생성하고, 참여하고, 관리하며 함께 성장할 수 있습니다.

Syntax Studio는 단순히 기능이 많은 서비스를 만드는 것이 아니라 **사용자가 오래 사용하고 싶은 서비스**를 만드는 것을 목표로 합니다.

---

# 회사 정보

## Company

**Syntax Studio**

### Mission

학생들이 진심으로 즐겨 사용하는 소프트웨어를 만든다.

### Vision

Apple 수준의 사용자 경험을 가진 서비스를 만드는 개발팀이 된다.

---

# 프로젝트 목표

현재 최우선 목표는 **안정적인 Beta 버전 출시**입니다.

항상 아래 우선순위를 유지합니다.

1. 보안
2. 사용자 경험
3. 안정성
4. 성능
5. 새로운 기능

기능 수보다 완성도를 우선합니다.

---

# 기술 스택

## Frontend

* Next.js (App Router)
* React
* TypeScript
* Tailwind CSS

## Backend

* Supabase
* PostgreSQL

## Deployment

* Vercel

## Version Control

* Git + GitHub

---

# 프로젝트 구조

```text
StudyHub/
├── CLAUDE.md
├── README.md
├── docs/
├── app/
├── components/
├── lib/
├── types/
├── messages/
├── i18n/
├── tests/
├── supabase/
└── package.json
```

---

# 반드시 읽을 문서

새로운 작업을 시작하기 전에 아래 문서를 참고합니다.

1. docs/PRODUCT.md
2. docs/ROADMAP.md
3. docs/ARCHITECTURE.md
4. docs/SECURITY.md
5. docs/BRAND.md
6. docs/TEAM.md

프로젝트 구조나 정책이 변경되면 관련 문서를 함께 업데이트합니다.

---

# 개발 철학

항상 다음 원칙을 따릅니다.

* 사용자 중심
* 보안 우선
* 단순한 설계
* 유지보수성
* 확장성
* 재사용 가능한 코드

---

# 코딩 규칙

항상

* TypeScript를 엄격하게 사용한다.
* 읽기 쉬운 코드를 작성한다.
* 중복 코드를 최소화한다.
* 기존 컴포넌트를 우선 재사용한다.
* 작은 단위로 기능을 분리한다.

지양

* 불필요한 복잡성
* 하드코딩
* 거대한 컴포넌트
* 사용하지 않는 코드

---

# UI 원칙

디자인 철학

* Apple에서 영감을 받은 미니멀한 UI
* Notion처럼 깔끔한 레이아웃
* 모바일 우선
* 접근성 고려

모든 화면은 일관된 디자인 시스템을 사용합니다.

---

# 보안 원칙

항상

* 인증 확인
* 권한 확인
* 입력값 검증
* RLS 정책 준수
* 환경 변수 사용

절대

* API Key 하드코딩
* 인증 우회
* 권한 검사 생략
* 민감한 정보 노출

---

# 성능 원칙

항상

* 필요한 데이터만 요청
* Lazy Loading 활용
* 이미지 최적화
* 불필요한 렌더링 방지
* 번들 크기 최소화

---

# Git 규칙

브랜치

* main
* develop
* feature/*
* fix/*
* hotfix/*

커밋 예시

* feat:
* fix:
* docs:
* refactor:
* style:
* test:
* chore:

---

# 작업 절차

새로운 기능은 항상 다음 순서를 따릅니다.

1. 요구사항 이해
2. 기존 코드 분석
3. 구현 계획 수립
4. 코드 작성
5. 테스트
6. 리팩터링
7. 문서 업데이트

---

# 문서 관리

새로운 기능이나 구조 변경 시 다음 문서를 업데이트합니다.

* PRODUCT.md
* ROADMAP.md
* ARCHITECTURE.md
* SECURITY.md
* CHANGELOG.md (존재하는 경우)

---

# Claude 작업 원칙

코드를 수정하기 전에

* 기존 프로젝트 구조를 이해한다.
* 관련 컴포넌트를 확인한다.
* 기존 스타일을 유지한다.

코드를 작성할 때

* 프로젝트의 구조를 존중한다.
* 일관된 네이밍을 사용한다.
* 유지보수가 쉬운 코드를 작성한다.
* 성능과 보안을 함께 고려한다.

작업 후

* 타입 오류를 확인한다.
* 빌드 가능 여부를 확인한다.
* 관련 문서 업데이트 여부를 검토한다.

---

# Claude가 적극적으로 제안해야 하는 사항

필요하다면 아래 내용을 제안합니다.

* 성능 개선
* 보안 개선
* 접근성 개선
* 코드 리팩터링
* 디자인 일관성
* 테스트 추가
* 문서 보완

---

# Claude가 하지 말아야 할 일

* 프로젝트 구조를 이유 없이 변경하지 않는다.
* 기존 UI 스타일을 임의로 바꾸지 않는다.
* 관련 없는 파일을 수정하지 않는다.
* 문서와 충돌하는 구현을 하지 않는다.
* 설명 없이 Breaking Change를 만들지 않는다.

---

# Definition of Done

작업은 아래 조건을 모두 만족해야 완료로 인정합니다.

* 기능 구현 완료
* TypeScript 오류 없음
* 빌드 가능
* 주요 기능 테스트 완료
* 문서 업데이트 완료
* 보안 검토 완료

---

# 장기 목표

StudyHub를 학생들이 가장 신뢰하는 스터디 플랫폼으로 성장시키고, Syntax Studio의 대표 서비스로 발전시킵니다.

모든 개발은 장기적인 유지보수성과 확장성을 고려하여 진행합니다.

---

# 최종 원칙

Claude는 항상 다음 순서를 기억합니다.

1. 문서를 읽는다.
2. 기존 구조를 이해한다.
3. 계획을 세운다.
4. 구현한다.
5. 테스트한다.
6. 문서를 업데이트한다.

**빠르게 개발하는 것보다, 오래 유지할 수 있는 코드를 만드는 것이 더 중요합니다.**

---

**End of CLAUDE.md**