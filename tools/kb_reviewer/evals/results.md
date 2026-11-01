# kb-reviewer eval

- real PR#17–21: caught 29/29 · missed 0 · findings 30 · FP 1 (FP rate 3.3%)
- synthetic: caught 10/10 · missed 0 · findings 10 · FP 0 (FP rate 0.0%)
- all: caught 39/39 · missed 0 · findings 40 · FP 1 (FP rate 2.5%)
- comment cites filename + rule wording only, no vault: OK

| case | expected | caught | missed | findings | FP | skipped (same as main) |
|---|---|---|---|---|---|---|
| pr17 | 4 | 4 | 0 | 5 | 1 | 0 |
| pr18 | 15 | 15 | 0 | 15 | 0 | 0 |
| pr19 | 3 | 3 | 0 | 3 | 0 | 0 |
| pr20 | 4 | 4 | 0 | 4 | 0 | 0 |
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

- FP pr17: R6_live_d1_ok worker/migrations/0012_rev_index.sql:4
- KNOWN CAUGHT pr18: 0015_down DROP COLUMN enc, no archive
- KNOWN CAUGHT pr18: 0013_down rerun name clash marks_archive_261031
- KNOWN CAUGHT pr18: relies on wrangler migration log (live has no d1_migrations)
