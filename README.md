# Screencast Hub

Proxmox VM + GPU パススルーを利用した、プロジェクター向け自作メディアセンター。

プロジェクターの Netflix DRM（低画質）問題を根本解決するため、Windows VM 上に高画質再生環境を構築し、Apple TV 風の自作ポータル UI からストリーミングサービスをワンタッチ起動できるシステム。AirPlay / Chromecast のキャスト受信にも対応。

## システム構成

```
┌──────────────────────────────────────────────────┐
│  Proxmox VE ホスト                                │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  Windows 11 VM                             │  │
│  │                                            │  │
│  │  Portal (React SPA)  ← http-server :3000   │  │
│  │  App Launcher API    ← Express    :3001    │  │
│  │  AirServer           ← キャスト受信         │  │
│  │  Unified Remote      ← リモート操作         │  │
│  │  Edge Kiosk Mode     ← 全画面表示          │  │
│  └────────────────────────────────────────────┘  │
│         │ HDMI (GPU パススルー)                    │
└─────────┼────────────────────────────────────────┘
          ▼
    [プロジェクター]
```

## 機能

- **ポータル UI** - Apple TV 風ダークテーマ、十字キー + Enter で操作（spatial navigation）
- **ストリーミング起動** - Netflix / YouTube / Prime Video / U-NEXT / FOD / ABEMA をワンタッチ起動
- **2 つの起動方式** - ブラウザ内遷移（YouTube 等）と ネイティブアプリ起動（Netflix、app-launcher 経由）
- **AirPlay / Chromecast 受信** - スマホや MacBook からのキャスト受信
- **リモコン操作** - Unified Remote でスマホをリモコン化
- **設定の外部化** - `config.json` を編集するだけでサービスの追加・変更が可能（リビルド不要）

## ディレクトリ構成

```
screencast-hub/
├── portal/               # React SPA（Vite）
│   ├── public/
│   │   ├── config.json   # サービス設定（外部化）
│   │   └── icons/        # サービスアイコン SVG
│   └── src/
│       ├── App.jsx
│       ├── components/   # Portal, ServiceCard, Clock, LaunchOverlay
│       ├── hooks/        # useConfig, useLauncher
│       └── styles/       # global.css, portal.css
├── app-launcher/         # ネイティブアプリ起動用ローカル API サーバー
│   └── server.js
└── docs/                 # 各フェーズの詳細手順書
```

## セットアップ

### ポータル（React SPA）

```bash
cd portal
npm install
npm run dev      # 開発サーバー（http://localhost:5173）
npm run build    # 本番ビルド（build/ に出力）
```

本番環境では `http-server` で配信:

```bash
npm install -g http-server
http-server portal/dist -p 3000 -c-1 --cors
```

### App Launcher（ネイティブアプリ起動 API）

```bash
cd app-launcher
npm install
npm start        # http://localhost:3001
```

## サービスの追加

`portal/public/config.json` の `services` 配列に追加するだけ:

```json
{
  "id": "tver",
  "name": "TVer",
  "color": "#0066FF",
  "icon": "/icons/tver.svg",
  "launchType": "browser",
  "launchTarget": "https://tver.jp",
  "description": "民放見逃し"
}
```

ページをリロードすれば反映されます。

## 実装フェーズ

| Phase | 内容 | 詳細 |
|-------|------|------|
| 1 | 基盤構築 | Proxmox VM + GPU パススルー |
| 2 | キャスト環境 | AirServer（AirPlay / Chromecast 受信） |
| 3 | 操作環境 | Unified Remote によるリモート操作 |
| 4 | ポータル UI | React SPA + spatial navigation |
| 5 | Kiosk 化・結合テスト | Edge Kiosk モード + 自動起動 |

各フェーズの詳細手順は `docs/` ディレクトリを参照。

## 技術スタック

- **フロントエンド:** React 19 + Vite
- **ナビゲーション:** @noriginmedia/norigin-spatial-navigation
- **App Launcher:** Node.js + Express
- **ホスティング:** http-server（ローカル配信）
- **ブラウザ:** Microsoft Edge（Kiosk モード）
- **仮想化:** Proxmox VE + GPU パススルー
