# kb-reviewer 검토 방침

이 파일은 사람이 읽는 방침이자, 나중에 모델을 붙일 때 그대로 쓸 프롬프트예요. 지금 판정은 `rules/*.ts` 가 해요(키·모델 없음).

1. 보는 것: PR이 **더한 줄만** 봐요. 지운 줄·기존 코드는 판정하지 않아요.
2. 규칙 9개(규칙마다 봇교훈 노트 파일 이름으로 근거를 달아요):
   - R1 먼저 백업 · 영구 삭제 대신 보관(DROP COLUMN/TABLE·DELETE 앞에 보관 표가 있는지)
   - R2 칸 추가(확장) → 코드 배포 → 옛 칸 정리(축소) 순서(앞으로 가는 migration 안의 축소)
   - R3 전후 행 수 비교(자료를 옮기는 SQL 파일 머리말에 확인 쿼리가 있는지)
   - R4 두 번 돌려도 같은 결과(IF NOT EXISTS 없는 CREATE, ADD COLUMN, 보관 이름 RENAME)
   - R5 코드·노트에 개인정보·비밀 키 없음(값은 가리고, 이름은 개수만)
   - R6 실 D1 변경은 유진님 OK(`d1 migrations apply`, `--remote`, 「wrangler 가 한 번만 돌린다」 가정)
   - R7 지우지 않기: rm·trap rm·rm -rf·fs.rmSync·shutil.rmtree 등 (주의/med)
   - R8 봇 상자 절대 경로(/home/box, /workspace) (참고/low)
   - R9 시험·코드의 이메일 문자열(example.com 포함) (참고/low)
   - 재구성(새 표→복사→DROP→이름 바꾸기)이라도 보관 이름·행 수 확인 없이 DROP TABLE = 주의(med) · 임시 표 IF NOT EXISTS 없음 = 참고(low) · 보관 직후 같은 단계 DROP COLUMN = 참고(low)
3. 하는 일: PR마다 댓글 **하나**(줄마다 위반·이유·고칠 것·근거 노트). 새 커밋이면 그 댓글을 고쳐 써요. main 과 내용이 같은 파일은 건너뛰어요.
4. 절대 안 하는 일: approve, request changes, merge, 코드 수정 push, 라벨·담당자 변경, 닫기.
5. 근거는 언제나 **노트 파일 이름 + 규칙 한 줄(우리 말)** 만 적어요. 교훈 문장·볼트 경로는 넣지 않아요(CI 에는 노트가 없어도 똑같이 돌아요).
6. 댓글을 올리기 전에 댓글 본문을 검사해서 통과할 때만 올려요: CI 는 `src/pii_gate.ts`(R5 패턴 + 모든 이메일 + 상자 경로, 값은 출력 안 함), 손으로 올릴 때는 pii_check(--target github) 종료 0.
