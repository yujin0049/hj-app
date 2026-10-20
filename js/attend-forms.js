/* 출석부·서명부 서식 모음. 다른 봇이 준 서식은 여기 한 덩어리만 더하면 돼요.
   cols: { label, field } = 명단에서 가져올 칸(field 이름은 attend-core.js FIELDS)
         { label, kind: 'no' }      = 연번
         { label, kind: 'blank' }   = 빈칸(서명·비고·날짜 등)
         { label, kind: 'picked' }  = 사용자가 고른 명단 칸들이 이 자리에 들어가요
         { label, kind: 'sessions' }= 날짜·회차 칸들(출석부)
         { label, kind: 'countO' }  = 출석 O 개수(엑셀 수식)
   sessions: { count, label(i, date) }  기본 회차 수와 칸 이름
   footer: 'countO' = 맨 아래 출석 인원 줄(엑셀 수식)
   tpl: 엑셀 저장 때 채울 빈 양식(forms/ 폴더). 테두리·병합·인쇄 설정이 그대로 남아요.
        first/last = 양식의 명단 첫 줄·끝 줄, map = { 열: 'no' | 필드 이름 | '=수식{r}' },
        set = { 칸: 글자 틀 } ({title} {when} {place} {host} {kind}), sess = { from: 열, label } 날짜 칸 이름,
        sum = { row, from, to, f } 맨 아래 합계 줄 수식({c} 열, {a}~{b} 명단 범위), titles = 쪽마다 반복할 제목 줄 */
(function (root) {
  'use strict';
  function dayLabel(unit) {
    return function (i, d) { return d ? d : (i + 1) + unit; };
  }
  root.APAttendForms = [
    {
      id: 'attend', name: '출석부 (기본)', kind: '출석부', orient: 'auto', src: '기본',
      sessions: { count: 5, label: dayLabel('회') },
      cols: [{ label: '연번', kind: 'no' }, { kind: 'picked' }, { kind: 'sessions' }, { label: '비고', kind: 'blank', w: 10 }]
    },
    {
      id: 'sign', name: '서명부 (기본)', kind: '서명부', orient: 'portrait', src: '기본',
      cols: [{ label: '연번', kind: 'no' }, { kind: 'picked' }, { label: '서명', kind: 'blank', w: 18 }, { label: '비고', kind: 'blank', w: 10 }]
    },
    {
      id: 'ojnt-attend', name: 'OJNT 어학연수 출석부', kind: '출석부', orient: 'landscape', src: '엑셀봇_OJNT어학연수_출석부_빈양식_v01.xlsx',
      sessions: { count: 20, label: dayLabel('일차') }, mark: 'O/X', footer: 'countO',
      tpl: { file: 'forms/ojnt_attend.xlsx', titles: '4:4', first: 5, last: 22, map: { A: 'no', B: 'name', C: 'gender', D: 'room', Y: '=COUNTIF(E{r}:X{r},"O")' },
        set: { A1: '{title}', B2: '{title0}', H2: '{when}', T2: '{place}' }, sess: { from: 'E', count: 20, label: function (i, d) { return (i + 1) + '일차\n(' + (d || ' / ') + ')'; } },
        sum: { row: 23, from: 'E', to: 'X', f: 'COUNTIF({c}{a}:{c}{b},"O")' } },
      cols: [{ label: '번호', kind: 'no' }, { label: '성명', field: 'name' }, { label: '성별', field: 'gender' }, { label: '호실', field: 'room' },
        { kind: 'sessions' }, { label: '출석일수', kind: 'countO' }, { label: '비고', kind: 'blank', w: 8 }]
    },
    {
      id: 'ojnt-dorm-sign', name: 'OJNT 기숙사 입사 서명부', kind: '서명부', orient: 'portrait', src: '엑셀봇_OJNT기숙사_서명부_빈양식_v01.xlsx',
      tpl: { file: 'forms/ojnt_dorm_sign.xlsx', titles: '6:6', first: 7, last: 26, map: { A: 'no', B: 'name', C: 'gender', D: 'room' },
        set: { A1: '{title}', A2: '○ 일시 : {when}', A3: '○ 장소 : {place}' } },
      cols: [{ label: '연번', kind: 'no' }, { label: '성명', field: 'name' }, { label: '성별', field: 'gender' }, { label: '호실', field: 'room' },
        { label: '입소일', kind: 'blank', w: 9 }, { label: '퇴소 예정일', kind: 'blank', w: 10 }, { label: '서명', kind: 'blank', w: 16 }, { label: '비고', kind: 'blank', w: 8 }]
    },
    {
      id: 'noncredit', name: '비교과 출석부 (학교 양식)', kind: '출석부', orient: 'landscape', src: '엑셀봇_비교과출석부_빈양식_v01.xlsx',
      sessions: { count: 16, label: function (i, d) { return (i + 1) + '주' + (d ? '\n' + d : '\n( / )'); } }, sub: '월,일 / 교시',
      tpl: { file: 'forms/noncredit_attend.xlsx', titles: '6:9', first: 10, last: 24, map: { A: 'no', C: 'sid', E: 'name' }, set: { A1: '{title}' } },
      cols: [{ label: '순번', kind: 'no' }, { label: '학번', field: 'sid' }, { label: '성명', field: 'name' },
        { kind: 'sessions' }, { label: '보강', kind: 'blank', w: 6 }, { label: '출석점수', kind: 'blank', w: 7 }]
    },
    {
      id: 'event-sign', name: '행사 참석자 등록부', kind: '서명부', orient: 'portrait', src: '행사참석자_등록부_빈양식.xlsx',
      tpl: { file: 'forms/event_sign.xlsx', titles: '7:7', first: 8, last: 37, map: { A: 'no', B: 'dept', C: 'grade', D: 'name' },
        set: { A1: '{host}', A2: '{title0} 참석자 등록부', A4: '■ 일 시 : {when}', A5: '■ 장 소 : {place}' } },
      cols: [{ label: '연번', kind: 'no' }, { label: '학과', field: 'dept' }, { label: '직/학년', field: 'grade' }, { label: '성명', field: 'name' },
        { label: '서명', kind: 'blank', w: 16 }, { label: '비고', kind: 'blank', w: 8 }]
    },
    {
      id: 'trip-sign', name: '현장견학 서명부', kind: '서명부', orient: 'portrait', src: '현장견학_서명부_빈양식.xlsx',
      tpl: { file: 'forms/trip_sign.xlsx', titles: '7:7', first: 8, last: 37, map: { A: 'no', B: 'kind', C: 'grade', D: 'sid', E: 'name' },
        set: { A1: '{title}', A3: '○ 일 시 : {when}', A4: '○ 장 소 : {place}', A5: '○ 소 속 : {host}' } },
      cols: [{ label: '연번', kind: 'no' }, { label: '구분', field: 'kind' }, { label: '학년/직위', field: 'grade' }, { label: '학번', field: 'sid' }, { label: '성명', field: 'name' },
        { label: '출발 서명', kind: 'blank', w: 12 }, { label: '도착 서명', kind: 'blank', w: 12 }, { label: '비고', kind: 'blank', w: 8 }]
    }
  ];
})(typeof globalThis !== 'undefined' ? globalThis : this);
