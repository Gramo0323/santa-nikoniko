# R25_SPEC_dechristmas (クリスマス残骸掃除 仕様書)

## 目的
Run1/Run2でだるまシーズンへ移行したが、UI上に残っている「サンタ/クリスマス」由来の文言・画像を「だるま/お正月」仕様へ完全に置換する。
内部ロジックやデータキーは触らず、ユーザーに見える部分のみを非破壊で修正する。

## 置換リスト

### 1. 文字列（UI表示のみ）
| 置換前 | 置換後 | 箇所 |
|---|---|---|
| `サンタさんの にこにこカレンダー` | `だるまさんの にこにこカレンダー` | `index.html` (title, h1) |
| `サンタスタンプ+1！` | `ごほうびスタンプ+1！` | `index.html`, `app.js` |
| `BONUS Santa` | `だるま ボーナス` | `app.js` (img alt) |

**置換しない（内部キー等）**:
- `STORAGE_KEY = "santa_nikoniko_v1"`
- `SEASON_ID_KEY = "santa_season_id"`
- `santa_sound_config`
- `santa_help_total`
- `app.js` 内の導線Aメッセージ（「サンタさんは おうちに かえりました」） ※意図的なお別れ文のため維持

### 2. 画像アセット
| ファイル名 | 用途 | 置換方針 |
|---|---|---|
| `assets/santa_stamp.png` | スゴロク進捗アイコン | 既存ファイルを `assets/daruma_stamp.png`（新規）へ変更し、CSSの参照先を修正。 |
| `assets/bonus-santa.png` | ボーナス演出画像 | 既存ファイルを `assets/bonus-daruma.png`（新規）へ変更し、JSの参照先を修正。 |

## 実装方針
- 既存の画像を削除せず、新しいだるま画像を `assets/` に追加。
- `app.js` および `styles.css` の参照パスを修正。
- 文字列置換は `multi_replace_file_content` で確実に行う。

## 画像生成プロンプト（予定）
- `daruma_stamp.png`: "A cute, stylized Japanese Daruma doll head icon, circular, traditional red color, high quality illustration, white background"
- `bonus-daruma.png`: "A cheerful, round traditional red Japanese Daruma doll, festive gold details, high quality illustration, transparent background feel"
