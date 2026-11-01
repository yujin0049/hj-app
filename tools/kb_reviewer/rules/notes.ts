// Rule -> one-line rule wording (our own words) + 봇교훈 note FILENAMES only.
// No lesson text and no vault path live here, so the same comment works in CI where the notes are not available.
import type { RuleId } from './types.ts';

export interface RuleCite { rule: string; notes: string[] }

export const NOTES: Record<RuleId, RuleCite> = {
  R1_backup: { rule: '지우거나 바꾸기 전에 백업하고, 지울 것은 보관 표/보관 이름으로 옮겨 둔다(영구 삭제 금지).',
    notes: ['261101_엘리트블로그_교훈.md', '261029_정리_노션.md'] },
  R2_expand_order: { rule: '칸 추가(확장) → 코드 배포 → 옛 칸 정리(축소)를 다른 단계로 나눈다.',
    notes: ['261101_엘리트블로그_교훈.md'] },
  R3_row_count: { rule: '자료를 옮기는 작업은 전후 행 수를 세어 같음을 확인하는 쿼리를 함께 둔다.',
    notes: ['261101_엘리트블로그_교훈.md'] },
  R4_idempotent: { rule: '두 번 돌려도 결과가 같아야 한다(IF NOT EXISTS · 이미 있으면 건너뜀).',
    notes: ['261101_엘리트블로그_교훈.md'] },
  R5_secret_pii: { rule: '코드·노트에 개인정보와 비밀 키 값을 넣지 않는다(env/secret 이름만).',
    notes: ['261027_이종에이전트_보드_세션교체.md', '261030_춘식이_클로드Code_다시쓰기.md'] },
  R6_live_d1_ok: { rule: '실 D1 변경은 미리보기 D1 먼저, 실 D1은 백업 뒤 유진님 OK 받고만 한다.',
    notes: ['261101_엘리트블로그_교훈.md'] },
  R7_no_delete: { rule: '파일·폴더를 지우지 않는다(rm 대신 .trash/_archive 로 옮김, 임시 폴더 정리도 같음).',
    notes: ['폴더정리.md', '옵시디언.md', 'OJNT·기숙사.md'] },
  R8_box_path: { rule: '저장소 산출물에 봇 상자 내부 절대 경로를 넣지 않는다(설정 값·상대 경로로).',
    notes: ['261028_F파일_옵시디언주소금지.md'] },
  R9_fake_contact: { rule: '시험·코드의 가짜 연락처(이메일 등)도 문자열 그대로 두지 않고 실행 때 조립한다.',
    notes: ['개인정보검사.md'] },
};
