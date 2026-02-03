# R2_SPEC_season_reset (シーズンリセット仕様書)

## 目的
2025/12/26のだるまシーズン開始に伴い、既存のサンタシーズンの進捗データを初期化する。
一度リセットした後は二重にリセットされないよう `seasonId` で管理する。

## キー棚卸し

### 消す（進捗データ）
| キー | 保存先 | 内容 |
|---|---|---|
| `santa_nikoniko_v1` | localStorage | 日付ごとのスタンプ JSON |
| `santa_help_total` | localStorage | おてつだい累計カウント |
| `progress` テーブル | Supabase | 12/26以前の全レコード（ログインユーザー用） |

### 残す（設定・フラグ）
| キー | 保存先 | 内容 |
|---|---|---|
| `santa_sound_config` | localStorage | 音のON/OFF、音量等 |
| `daruma_onboarding_v1` | localStorage | 導線A（おひっこし案内）の既読フラグ |
| `themeId` | localStorage | 現在のテーマ設定 |
| `sb-<id>-auth-token` | localStorage | Supabase Auth セッション情報 |

## seasonId 仕様
- **ID名**: `daruma_2025_12_26`
- **保存先（未ログイン）**: localStorage キー `santa_season_id`
- **保存先（ログイン）**: Supabase Auth `user_metadata.seasonId`

## リセット処理フロー

### 1. 判定タイミング
- ページロード時（`loadData` 前後）
- ログイン完了時（`updateAuthUI` 内）

### 2. 判定ロジック
- 現在のJST時刻が 2025/12/26 00:00:00 以上であること
- 取得した `seasonId`（localまたはmeta）が `CURRENT_SEASON_ID` と一致しないこと

### 3. リセットの実行
#### A. 未ログイン時
1. `appState = {}`
2. `helpTotal = 0`
3. localStorage から `santa_nikoniko_v1`, `santa_help_total` を削除
4. localStorage に `santa_season_id = CURRENT_SEASON_ID` をセット
5. `renderDays()`, `updatePoints()` 等で画面更新

#### B. ログイン時
1. 上記 A-1〜2 を実行（メモリ上）
2. Supabase の `progress` テーブルから当該ユーザー・当該ボードのデータを全削除（または上書き初期化）
3. `supabase.auth.updateUser({ data: { seasonId: CURRENT_SEASON_ID } })` を実行
4. 完了後、画面更新

## 異常系・フォールバック
- `updateUser` が失敗した場合、localStorage側の `seasonId` のみを更新し、その端末での再発火を防ぐ。
- ブラウザのシークレットモード等で localStorage が消えた場合、ログインしていれば user_metadata により保護される。
