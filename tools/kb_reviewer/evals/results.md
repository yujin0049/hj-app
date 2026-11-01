# kb-reviewer eval

- real PR#17–21 · 정답표 v1 (cases.json): caught 29/29 · missed 0 · findings 41 · FP 12 (FP rate 29.3%)
- synthetic: caught 17/17 · missed 0 · findings 17 · FP 0 (FP rate 0.0%)
- all: caught 46/46 · missed 0 · findings 58 · FP 12 (FP rate 20.7%)
- comment cites filename + rule wording only, no vault: OK
- pii gate on a comment with all synthetic findings (values masked): OK

| case | expected | caught | missed | findings | FP | skipped (same as main) |
|---|---|---|---|---|---|---|
| pr17 | 4 | 4 | 0 | 7 | 3 | 0 |
| pr18 | 15 | 15 | 0 | 23 | 8 | 0 |
| pr19 | 3 | 3 | 0 | 3 | 0 | 0 |
| pr20 | 4 | 4 | 0 | 5 | 1 | 0 |
| pr21 | 3 | 3 | 0 | 3 | 0 | 0 |
| s01_contract_in_forward | 2 | 2 | 0 | 2 | 0 | - |
| s02_drop_table_no_backup | 1 | 1 | 0 | 1 | 0 | - |
| s03_delete_no_backup | 1 | 1 | 0 | 1 | 0 | - |
| s04_secrets | 4 | 4 | 0 | 4 | 0 | - |
| s05_live_commands | 2 | 2 | 0 | 2 | 0 | - |
| s06_clean_migration | 0 | 0 | 0 | 0 | 0 | - |
| s07_clean_rollback_archive | 0 | 0 | 0 | 0 | 0 | - |
| s08_clean_code_with_env_and_fake_name | 0 | 0 | 0 | 0 | 0 | - |
| s09_skip_file_already_on_main | 0 | 0 | 0 | 0 | 0 | - |
| s10_self_folder_skipped | 0 | 0 | 0 | 0 | 0 | - |
| s11_rm_in_script | 2 | 2 | 0 | 2 | 0 | - |
| s12_box_path | 1 | 1 | 0 | 1 | 0 | - |
| s13_fake_email_literal | 1 | 1 | 0 | 1 | 0 | - |
| s14_rebuild_drop_no_count | 3 | 3 | 0 | 3 | 0 | - |

- FP pr17: R8_box_path verify/run.sh:7
- FP pr17: R7_no_delete verify/run.sh:10
- FP pr17: R6_live_d1_ok worker/migrations/0012_rev_index.sql:4
- KNOWN CAUGHT pr18: 0015_down DROP COLUMN enc, no archive
- KNOWN CAUGHT pr18: 0013_down rerun name clash marks_archive_261031
- KNOWN CAUGHT pr18: relies on wrangler migration log (live has no d1_migrations)
- FP pr18: R4_idempotent docs/rollback/0013_down.sql:7
- FP pr18: R1_backup docs/rollback/0014_down.sql:10
- FP pr18: R8_box_path public/brand-c.css:2
- FP pr18: R8_box_path public/crm/crm-kit.js:1
- FP pr18: R8_box_path public/crm/crm.css:1
- FP pr18: R8_box_path tests/brand.test.js:28
- FP pr18: R4_idempotent worker/migrations/0013_marks_excused.sql:7
- FP pr18: R1_backup worker/migrations/0013_marks_excused.sql:17
- FP pr20: R9_fake_contact tests/cal06.test.js:48

## 정답표 v2 (cases_v2.json): caught 41/41 · missed 0 · findings 41 · FP 0 (FP rate 0.0%)

## 두 번째 정답표(교차 eval, 10건): caught 10/10 · missed 0 · 정답표 밖 지적 30

| id | PR | file:line | 기대 sev | 리뷰어 | 리뷰어 sev |
|---|---|---|---|---|---|
| E1 | #17 | verify/run.sh:10 | med | R7_no_delete | med |
| E2 | #17 | verify/run.sh:7 | low | R8_box_path | low |
| E3 | #18 | worker/migrations/0013_marks_excused.sql:17 | med | R1_backup | med |
| E4 | #18 | worker/migrations/0013_marks_excused.sql:7 | low | R4_idempotent | low |
| E5 | #18 | worker/migrations/0014_prof_notes.sql:25 | low | R4_idempotent | med |
| E6 | #18 | worker/migrations/0015_link_enc.sql:5 | low | R4_idempotent | med |
| E7 | #18 | docs/rollback/0015_down.sql:4 | low | R1_backup | high |
| E8 | #18 | docs/rollback/0014_down.sql:10 | low | R1_backup | low |
| E9 | #20 | worker/migrations/0017_walkin.sql:6 | low | R4_idempotent | med |
| E10 | #20 | tests/cal06.test.js:48 | low | R9_fake_contact | low |

정답표 밖 지적(규칙별): R4_idempotent 14 · R6_live_d1_ok 6 · R3_row_count 6 · R8_box_path 4
