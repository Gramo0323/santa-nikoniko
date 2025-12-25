# R25_EVIDENCE_dechristmas (クリスマス残骸掃除 エビデンス)

## 検証結果サマリー
UIから「サンタ/クリスマス」由来の表現を排し、だるま仕様へ置換しました。

| 項目 | ステータス | 備考 |
|---|---|---|
| UI文字列置換 | ✅ 完了 | title, h1, helpRemaining 等 |
| 画像アセット置換 | ✅ 完了 | `daruma_stamp.png`, `bonus-daruma.png` |
| 内部キー維持 | ✅ 完了 | `santa_nikoniko_v1` 等は変更なし |
| P0ゲート回帰 | ✅ PASS | リセット・保存機能も正常 |

## スクリーンショット
- **Before (残骸あり)**: `run25_ui_before_1766650071537.png`
- **After (だるま化完了)**: `run25_ui_after_1766650236053.png`
  - ヘッダーが「だるまさんにこにこカレンダー」
  - おてつだいが「ごほうびスタンプ+1！」
  - スゴロクの顔がサンタではなく新しいだるまアイコンになっている

## 観測ログ
- 2025-12-25 17:30 JST 実施。
- 画像は `generate_image` で新規生成し、`assets/` に追加。
- `app.js` の `updateHelpUI`, `renderSugoroku` 内のUI生成コードを修正。
