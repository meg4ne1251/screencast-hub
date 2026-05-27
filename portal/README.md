# Portal（Screencast Hub）

Apple TV 風の自作ポータル UI。React + Vite 製の SPA で、十字キー + Enter による
spatial navigation に対応し、Kiosk モードの Edge から全画面表示する。

サービス一覧やテーマは `public/config.json` を編集するだけで変更でき、リビルドは不要
（本番では `http-server` がそのまま配信するため、`dist/config.json` を書き換える）。

## 開発

```bash
npm install
npm run dev      # 開発サーバー（http://localhost:3000）
npm run build    # 本番ビルド（dist/ に出力）
npm run preview  # ビルド成果物のプレビュー（http://localhost:3000）
npm run lint     # ESLint
```

## 本番配信

```bash
npm install -g http-server
http-server dist -p 3000 -c-1 --cors
```

## 設定（public/config.json）

| キー | 説明 |
|------|------|
| `portalName` / `subtitle` | ヘッダーに表示するタイトル |
| `columns` | サービスグリッドの列数 |
| `appLauncherUrl` | ネイティブ起動 API（app-launcher）の URL |
| `theme` | 背景グラデーション・アクセントカラー・フォント |
| `services[]` | 各サービスの定義（下記） |

### services[] の各フィールド

| キー | 説明 |
|------|------|
| `id` | 一意の識別子。`launchType: native` では app-launcher のアプリ ID も兼ねる |
| `name` / `description` | カードに表示する名称・説明 |
| `color` | カードのアクセントカラー |
| `icon` | アイコン SVG のパス（`/icons/...`） |
| `launchType` | `browser`（ブラウザ内遷移）または `native`（app-launcher 経由でネイティブアプリ起動） |
| `launchTarget` | `browser` では遷移先 URL、`native` ではアプリ ID |
| `fallbackUrl` | `native` 用。app-launcher に到達できない／起動失敗時に遷移する Web 版 URL |

## ディレクトリ

```
portal/
├── public/
│   ├── config.json      # サービス設定（外部化）
│   └── icons/           # サービスアイコン SVG
└── src/
    ├── App.jsx
    ├── components/      # Portal, ServiceCard, Clock, LaunchOverlay
    ├── hooks/           # useConfig, useLauncher
    └── styles/          # global.css, portal.css
```
