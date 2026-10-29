# PRODUCT.md — hj-app (연습장)

<!-- impeccable:product-schema 1 -->

## Platform

web

## Audience / 대상
- **KO:** 경남항공교육원 학생·교원·주무관
- **EN:** Students, faculty, and administrative officers at Gyeongnam Aviation High School (항공교육원)

## Users / 쓰는 사람 (2026-10-29 유진님 확인)
- **KO:** 실제로는 **한 사람**(행정 담당)이 **휴대폰(폭 390px)**으로 매일 쓰는 개인 행정 업무 앱. 공개 안내 화면은 위 대상도 볼 수 있음.
- **EN:** In practice one administrative officer uses it daily on a phone (390px wide). Public guidance surfaces may still reach the audience above.

## Operating Context / 쓰는 상황
- 휴대폰 한 손 사용, 하단 탭 이동. 화면: 홈, 협조 검색(#/coop), 업무 차트(#/charts), 중요문서(#/docs, 폰 저장 금지 network-only) 등.
- 자료는 `data/*.json` 정본에서 옴(화면에서 지어내지 않음).

## Brand Commitments / 느낌 (사용자 지정)
- **차분하고 믿음직하게(calm, trustworthy).** 화려함보다 읽기 쉬움·일관성. 장식보다 정보.

## Purpose / 목적
- **KO:** 행정 연습장·안내 화면. 실제 결재·개인정보 정본이 아님. 시안·프로토타입·공개 안내용.
- **EN:** Admin practice / information surfaces. Not the system of record for approvals or PII. Prototypes, demos, and public guidance.

## Voice / 톤
- **KO:** 직설·짧음. 군더더기·마케팅 문장 금지. 결론 먼저.
- **EN:** Direct and short. No fluff or marketing copy. Lead with the answer.

## Constraints / 제약
- **KO:** 개인정보 주의. 공개 실명 유지는 기존 정책 따름(무단 비실명화·무단 공개 금지). 항공정비 공식 컬러(TEMPERING)·Soft Glow Squircle을 디자인 정본으로 함 — Impeccable 기본 안티패턴이 이 팔레트를 덮어쓰지 말 것.
- **EN:** Handle PII carefully. Keep public real-name policy as already set (no silent anonymization or unauthorized disclosure). Official TEMPERING palette and Soft Glow Squircle are design canon — Impeccable anti-Inter/purple defaults must not override them.

## Product Principles / 원칙
- 결론 먼저, 짧게. 한 화면에 한 질문.
- 실데이터만. 없으면 「데이터 없음」.
- 기능·데이터·라우트는 디자인 손질로 바꾸지 않음.
- 390px 폰에서 글자는 12.8px 이상, 대비 4.5:1 이상.

## Out of scope / 범위 밖
- Production payment, formal HR/payroll source of truth, or replacing Obsidian/창구 as document canon.
