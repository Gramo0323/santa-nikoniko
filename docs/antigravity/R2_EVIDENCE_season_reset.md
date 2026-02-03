# R2_EVIDENCE_season_reset (シーズンリセット エビデンス)

## 検証結果サマリー

| ID | テスト内容 | 結果 | 備考 |
|---|---|---|---|
| T1 | 未ログイン（強制リセット） | ✅ PASS | localStorageクリア後の初回起動でリセット発火を確認 |
| T2 | ログイン（メタデータリセット） | ✅ PASS | `updateAuthUI` 内での `seasonId` 不一致検知とリセットを確認 |
| T3 | 回帰テスト（Run1要素維持） | ✅ PASS | だるまUI、判子枠、期間表示が維持されていることを確認 |

## 観測ログ (T1: 未ログイン)
- **ログ出力**: `Season reset triggered (Local)`
- **LocalStorage**:
  - `santa_season_id`: `"daruma_2025_12_26"` (保存成功)
  - `santa_nikoniko_v1`: リセット後は空、操作後に保存
- **UI**: ぜんぶ 0てん から開始されることを確認。

## 観測ログ (T2: ログイン)
- `session.user.user_metadata.seasonId` を参照。
- 更新時は `supabase.auth.updateUser({ data: { seasonId: "daruma_2025_12_26" } })` を実施。
- ページリロード後も `isHydrated` が完了するまで `loadData` が走らず、安全にリセットが完了。

## スクリーンショット
- **T1 成功確認**: `r2_t1_reset_success_1766648158703.png`
  - リセット後に😊を1つ押し、リロードしても消えていない状態。
  - ヘッダーが「だるま」のままであることを確認。
