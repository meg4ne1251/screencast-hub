# Phase 4: 専用UIの開発（自作ポータルサイト）詳細手順書

## 環境情報
- **フレームワーク:** React（SPA）
- **ナビゲーション:** @noriginmedia/norigin-spatial-navigation（十字キー＋Enter操作）
- **デザイン:** Apple TV風ダークテーマ、タイル型レイアウト
- **ホスティング:** ローカルHTTPサーバー（http-server）
- **対応サービス:** Netflix, YouTube, Prime Video, U-NEXT, FOD, ABEMA（追加可能）

---

## アーキテクチャ概要

```
┌─────────────────────────────────────────────────────┐
│  Windows 11 VM「メディアセンターVM」                     │
│                                                     │
│  ┌──────────────────┐  ┌────────────────────────┐   │
│  │ http-server      │  │ app-launcher           │   │
│  │ (ポート 3000)     │  │ (ポート 3001)           │   │
│  │ React SPA配信     │  │ アプリ起動用ローカルAPI   │   │
│  └───────┬──────────┘  └───────────┬────────────┘   │
│          │                         │                │
│  ┌───────▼─────────────────────────▼────────────┐   │
│  │ Chrome/Edge (Kioskモード)                     │   │
│  │ http://localhost:3000                         │   │
│  │                                               │   │
│  │  ┌─────────────────────────────────────────┐  │   │
│  │  │ Screencast Hub Portal (React SPA)               │  │   │
│  │  │                                         │  │   │
│  │  │  [Netflix] [YouTube] [Prime Video]      │  │   │
│  │  │  [U-NEXT]  [FOD]     [ABEMA]           │  │   │
│  │  │                                         │  │   │
│  │  │  ← → ↑ ↓ で選択  Enter で起動           │  │   │
│  │  └─────────────────────────────────────────┘  │   │
│  └───────────────────────────────────────────────┘   │
│                                                     │
│  ┌───────────────┐  ┌──────────────────────┐        │
│  │ AirServer     │  │ Unified Remote Server│        │
│  │ (Phase 2)     │  │ (Phase 3)            │        │
│  └───────────────┘  └──────────────────────┘        │
└─────────────────────────────────────────────────────┘
         │ HDMI (GPUパススルー)
         ▼
   [XGIMI プロジェクター]
```

---

## 重要な設計判断: アプリ起動方式

### 問題
Netflix以外のストリーミングサービス（U-NEXT、FOD、ABEMA等）にはWindowsアプリ用のURIスキーム（`netflix://` のようなもの）が存在しない。

### 解決策: 2つの起動方式を使い分け

| 起動方式 | 対象サービス | 仕組み |
|---------|-------------|--------|
| **ブラウザ内遷移** | YouTube, Prime Video, U-NEXT, FOD, ABEMA | ポータルと同じブラウザ内でURLを開く。ESC/戻るでポータルに戻る |
| **ネイティブアプリ起動** | Netflix | ローカルAPIサーバー経由でWindowsアプリを起動。DRM制限のためネイティブアプリが必須 |

### ネイティブアプリ起動用ローカルAPIサーバー（app-launcher）
ブラウザからWindowsアプリを直接起動できないため、小さなローカルサーバーを用意する。

```javascript
// app-launcher/server.js (Node.js Express)
const express = require('express');
const { exec } = require('child_process');
const cors = require('cors');

const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// アプリ起動エンドポイント
app.post('/launch', (req, res) => {
  const { appId } = req.body;

  const apps = {
    'netflix': 'start netflix:',
    // 他にネイティブアプリが必要な場合はここに追加
  };

  const command = apps[appId];
  if (!command) {
    return res.status(404).json({ error: 'App not found' });
  }

  exec(command, (error) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ status: 'launched', appId });
  });
});

// ポータルに戻る（ブラウザをフォアグラウンドに）
app.post('/focus-portal', (req, res) => {
  // PowerShellでブラウザウィンドウをフォアグラウンドにする
  const ps = `
    Add-Type -AssemblyName Microsoft.VisualBasic
    $process = Get-Process -Name msedge -ErrorAction SilentlyContinue |
      Where-Object { $_.MainWindowTitle -ne '' } | Select-Object -First 1
    if ($process) {
      [Microsoft.VisualBasic.Interaction]::AppActivate($process.Id)
    }
  `;
  exec(`powershell -Command "${ps.replace(/\n/g, '; ')}"`, (error) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ status: 'focused' });
  });
});

app.listen(3001, () => console.log('App Launcher running on :3001'));
```

---

## Step 1: 開発環境のセットアップ

### 1-1. Node.jsのインストール
Windows VM内で：
1. https://nodejs.org からLTS版をダウンロード・インストール
2. 確認：
```cmd
node --version
npm --version
```

### 1-2. Reactプロジェクトの作成
```cmd
cd C:\Users\%USERNAME%\
npx create-react-app yamato-portal
cd yamato-portal
```

### 1-3. 依存パッケージのインストール
```cmd
npm install @noriginmedia/norigin-spatial-navigation
```

app-launcher用（別ディレクトリ）：
```cmd
mkdir C:\Users\%USERNAME%\app-launcher
cd C:\Users\%USERNAME%\app-launcher
npm init -y
npm install express cors
```

---

## Step 2: サービス設定ファイル（外部JSON）

### 2-1. config.jsonの配置
`yamato-portal/public/config.json` に配置する。

```json
{
  "portalName": "Screencast Hub",
  "subtitle": "Media Center",
  "columns": 3,
  "services": [
    {
      "id": "netflix",
      "name": "Netflix",
      "color": "#E50914",
      "icon": "/icons/netflix.svg",
      "emoji": "🎬",
      "launchType": "native",
      "launchTarget": "netflix",
      "description": "映画・ドラマ"
    },
    {
      "id": "youtube",
      "name": "YouTube",
      "color": "#FF0000",
      "icon": "/icons/youtube.svg",
      "emoji": "▶",
      "launchType": "browser",
      "launchTarget": "https://www.youtube.com",
      "description": "動画"
    },
    {
      "id": "prime-video",
      "name": "Prime Video",
      "color": "#00A8E1",
      "icon": "/icons/prime-video.svg",
      "emoji": "📺",
      "launchType": "browser",
      "launchTarget": "https://www.amazon.co.jp/gp/video/storefront",
      "description": "映画・ドラマ・アニメ"
    },
    {
      "id": "unext",
      "name": "U-NEXT",
      "color": "#00B900",
      "icon": "/icons/unext.svg",
      "emoji": "🎞",
      "launchType": "browser",
      "launchTarget": "https://video.unext.jp",
      "description": "映画・ドラマ・アニメ"
    },
    {
      "id": "fod",
      "name": "FOD",
      "color": "#FF6B00",
      "icon": "/icons/fod.svg",
      "emoji": "📡",
      "launchType": "browser",
      "launchTarget": "https://fod.fujitv.co.jp",
      "description": "フジテレビ見逃し"
    },
    {
      "id": "abema",
      "name": "ABEMA",
      "color": "#33CC33",
      "icon": "/icons/abema.svg",
      "emoji": "📱",
      "launchType": "browser",
      "launchTarget": "https://abema.tv",
      "description": "ニュース・アニメ・バラエティ"
    }
  ],
  "theme": {
    "bgGradient": "linear-gradient(160deg, #0a0a0f 0%, #1a1a2e 40%, #16213e 100%)",
    "accentColor": "#6366f1",
    "fontFamily": "'SF Pro Display', 'Hiragino Sans', 'Yu Gothic UI', sans-serif"
  }
}
```

### 2-2. サービスの追加方法
新しいサービスを追加するには、`services` 配列に新しいオブジェクトを追加するだけ：

```json
{
  "id": "tver",
  "name": "TVer",
  "color": "#0066FF",
  "icon": "/icons/tver.svg",
  "emoji": "📺",
  "launchType": "browser",
  "launchTarget": "https://tver.jp",
  "description": "民放見逃し"
}
```

→ ページをリロードするだけで反映される（ビルドの再実行不要）。

---

## Step 3: React SPAの実装

### 3-1. プロジェクト構成

```
yamato-portal/
├── public/
│   ├── index.html
│   ├── config.json          ← サービス設定（外部化）
│   └── icons/               ← サービスアイコンSVG
│       ├── netflix.svg
│       ├── youtube.svg
│       └── ...
├── src/
│   ├── App.jsx              ← メインコンポーネント
│   ├── components/
│   │   ├── Portal.jsx       ← ポータルメイン画面
│   │   ├── ServiceCard.jsx  ← サービスカード
│   │   ├── Clock.jsx        ← 時計表示
│   │   └── LaunchOverlay.jsx ← 起動中オーバーレイ
│   ├── hooks/
│   │   ├── useConfig.js     ← config.jsonの読み込み
│   │   └── useLauncher.js   ← アプリ起動ロジック
│   ├── styles/
│   │   └── global.css       ← グローバルスタイル
│   └── index.js
└── package.json
```

### 3-2. 主要コンポーネントの設計

**App.jsx（メインエントリ）:**
- config.jsonをfetch()で読み込み
- norigin-spatial-navigationの初期化
- ポータル画面のレンダリング

**Portal.jsx（メイン画面）:**
- サービスカードのグリッド表示
- 十字キーナビゲーション（spatial navigation）
- フォーカス状態の管理
- サービス起動処理の振り分け

**ServiceCard.jsx（カード）:**
- Apple TV風のフォーカスアニメーション
  - フォーカス時: scale(1.12), グロー, 影
  - 非フォーカス時: scale(1), 控えめな影
- サービスアイコン + 名前 + 説明の表示

**Clock.jsx（時計）:**
- 現在時刻と日付を表示（Apple TV風の薄いフォント）
- 1秒ごとに更新

### 3-3. Spatial Navigation（十字キー操作）の実装

```jsx
// App.jsx の初期化
import { init } from '@noriginmedia/norigin-spatial-navigation';

init({
  debug: false,
  visualDebug: false,
});

// ServiceCard.jsx でのフォーカス管理
import { useFocusable, FocusContext } from
  '@noriginmedia/norigin-spatial-navigation';

function ServiceCard({ service, onSelect }) {
  const { ref, focused } = useFocusable({
    onEnterPress: () => onSelect(service),
  });

  return (
    <div
      ref={ref}
      style={{
        transform: focused ? 'scale(1.12)' : 'scale(1)',
        boxShadow: focused
          ? `0 12px 40px ${service.color}66, 0 0 0 3px rgba(255,255,255,0.4)`
          : '0 4px 12px rgba(0,0,0,0.3)',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        // ... その他のスタイル
      }}
    >
      {/* カード内容 */}
    </div>
  );
}
```

### 3-4. サービス起動ロジック

```jsx
// hooks/useLauncher.js
const APP_LAUNCHER_URL = 'http://localhost:3001';

export function useLauncher() {
  const launchService = async (service) => {
    if (service.launchType === 'native') {
      // ネイティブアプリ起動（ローカルAPIサーバー経由）
      try {
        await fetch(`${APP_LAUNCHER_URL}/launch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId: service.id }),
        });
      } catch (error) {
        // APIサーバーが応答しない場合はフォールバック
        window.location.href = service.launchTarget;
      }
    } else if (service.launchType === 'browser') {
      // ブラウザ内遷移
      window.location.href = service.launchTarget;
    }
  };

  const focusPortal = async () => {
    try {
      await fetch(`${APP_LAUNCHER_URL}/focus-portal`, { method: 'POST' });
    } catch (error) {
      console.warn('Focus portal failed:', error);
    }
  };

  return { launchService, focusPortal };
}
```

---

## Step 4: 10-foot UIデザインガイドライン

プロジェクターに映すUIのため、通常のWebとは異なるデザイン基準が必要。

### 4-1. タイポグラフィ（1080p プロジェクション想定）

| 要素 | サイズ | ウェイト |
|------|--------|---------|
| ポータル名（ヘッダー） | 32px | 600 (Semi-bold) |
| 時計 | 48px | 200 (Thin) |
| サービス名 | 18px | 600 (Semi-bold) |
| サービス説明 | 11-12px | 300 (Light) |
| 操作ガイド（フッター） | 13px | 300 (Light) |

### 4-2. カードサイズとグリッド

| 項目 | 値 |
|------|-----|
| カードサイズ | 220px × 140px |
| グリッド列数 | 3（6サービスで2行） |
| カード間隔（gap） | 28px |
| フォーカス時スケール | 1.12 (12%拡大) |
| 角丸 | 18px |

### 4-3. カラーパレット

| 用途 | カラー |
|------|--------|
| 背景メイン | #0a0a0f → #1a1a2e → #16213e (グラデーション) |
| テキスト（プライマリ） | #ffffff |
| テキスト（セカンダリ） | rgba(255,255,255, 0.6) |
| テキスト（ミュート） | rgba(255,255,255, 0.3) |
| フォーカスリング | rgba(255,255,255, 0.4) |
| 装飾（アクセント） | #6366f1 (indigo) |

### 4-4. アニメーション

| 効果 | CSS |
|------|-----|
| フォーカスイン | `transform: scale(1.12)` + グロー + リング |
| トランジション | `0.25s cubic-bezier(0.4, 0, 0.2, 1)` |
| 起動オーバーレイ | フェードイン 0.3s + アイコンパルス |

---

## Step 5: ビルドとローカルホスティング

### 5-1. Reactアプリのビルド
```cmd
cd C:\Users\%USERNAME%\yamato-portal
npm run build
```
→ `build/` フォルダに静的ファイルが生成される。

### 5-2. http-serverのインストールと起動
```cmd
npm install -g http-server
```

起動テスト：
```cmd
http-server C:\Users\%USERNAME%\yamato-portal\build -p 3000 -c-1 --cors
```
- `-p 3000` → ポート3000
- `-c-1` → キャッシュ無効（config.json変更を即時反映）
- `--cors` → CORS許可

ブラウザで `http://localhost:3000` にアクセスして確認。

### 5-3. app-launcherの起動
```cmd
cd C:\Users\%USERNAME%\app-launcher
node server.js
```
→ ポート3001で起動。

### 5-4. 自動起動の設定（タスクスケジューラ）

**ポータルサーバー（http-server）：**
```powershell
# タスクスケジューラに登録するPowerShellスクリプト
$action = New-ScheduledTaskAction -Execute "cmd.exe" `
  -Argument "/c http-server C:\Users\%USERNAME%\yamato-portal\build -p 3000 -c-1 --cors"
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "ScreencastHubPortal-WebServer" `
  -Action $action -Trigger $trigger -Settings $settings `
  -Description "Screencast Hub Portal Web Server"
```

**app-launcher：**
```powershell
$action = New-ScheduledTaskAction -Execute "node.exe" `
  -Argument "C:\Users\%USERNAME%\app-launcher\server.js"
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "ScreencastHubPortal-AppLauncher" `
  -Action $action -Trigger $trigger -Settings $settings `
  -Description "Screencast Hub Portal App Launcher API"
```

---

## Step 6: ブラウザ内でのサービス利用とポータル復帰

### 6-1. ブラウザ内遷移フロー

```
[ポータル (localhost:3000)]
    │ Enter押下（YouTube選択）
    ▼
[YouTube (youtube.com)]
    │ Alt+Home または ESC連打
    ▼
[ポータル (localhost:3000)]  ← ブラウザのホームページに設定
```

### 6-2. ブラウザのホームページ設定
Kioskモードのブラウザのホームページを `http://localhost:3000` に設定しておくことで、`Alt+Home` でポータルに戻れる。

### 6-3. Unified Remote連携
Phase 3で作成したカスタムリモート「Screencast Hub Portal」の「ポータルに戻る」ボタンが `Alt+Home` を送信するので、リモコン操作でも戻れる。

---

## Step 7: config.jsonの運用

### 7-1. サービスの追加手順
1. `C:\Users\%USERNAME%\yamato-portal\build\config.json` をテキストエディタで開く
2. `services` 配列に新しいオブジェクトを追加
3. ブラウザをリロード（F5 / リモートのF5ボタン）

### 7-2. ホットリロードの仕組み
React SPAは起動時にfetch()でconfig.jsonを読み込む。ページリロードなしで反映したい場合は、ポーリング機能を有効化：

```jsx
// 30秒ごとにconfig.jsonを再読み込み
useEffect(() => {
  const interval = setInterval(async () => {
    try {
      const res = await fetch('/config.json?' + Date.now());
      const config = await res.json();
      setServices(config.services);
    } catch (e) { /* ignore */ }
  }, 30000);
  return () => clearInterval(interval);
}, []);
```

---

## Step 8: 動作確認チェックリスト

### 開発環境
- [ ] Node.jsがインストールされている
- [ ] Reactプロジェクトが作成されている
- [ ] norigin-spatial-navigationがインストールされている
- [ ] `npm start` でデバッグ版が起動する

### UIの動作
- [ ] ポータル画面が表示される（Apple TV風ダークテーマ）
- [ ] 矢印キーでフォーカスが移動する
- [ ] フォーカスしたカードが拡大・グローする
- [ ] Enterでサービスが起動する
- [ ] 時計が正しく表示・更新される
- [ ] 起動中オーバーレイが表示される

### サービス起動
- [ ] Netflix → ネイティブアプリが起動する（app-launcher経由）
- [ ] YouTube → ブラウザ内でYouTubeが開く
- [ ] Prime Video → ブラウザ内でPrime Videoが開く
- [ ] U-NEXT → ブラウザ内でU-NEXTが開く
- [ ] FOD → ブラウザ内でFODが開く
- [ ] ABEMA → ブラウザ内でABEMAが開く

### ナビゲーション
- [ ] Alt+Home でポータルに戻れる
- [ ] Unified Remoteの「ポータルに戻る」ボタンで戻れる

### 設定
- [ ] config.jsonを編集してサービスを追加できる
- [ ] ページリロードで変更が反映される

### ホスティング
- [ ] `npm run build` が成功する
- [ ] http-server でビルド版が配信される
- [ ] app-launcher が起動している
- [ ] タスクスケジューラで自動起動が設定されている

---

## トラブルシューティング

### 矢印キーでフォーカスが動かない
1. spatial-navigationが初期化されているか確認（`init()` の呼び出し）
2. `useFocusable()` がカードコンポーネントに適用されているか確認
3. ブラウザのフォーカスがポータル画面にあるか確認（他の要素にフォーカスが奪われていないか）

### config.jsonの変更が反映されない
1. http-serverの `-c-1` オプション（キャッシュ無効）が付いているか確認
2. ブラウザのキャッシュをクリア（Ctrl+Shift+R）
3. fetch URLにタイムスタンプを付けてキャッシュバスト: `fetch('/config.json?' + Date.now())`

### Netflixアプリが起動しない
1. app-launcher（ポート3001）が起動しているか確認
2. Netflixアプリがインストールされているか確認（Microsoft Storeから）
3. CORS設定が正しいか確認（`origin: 'http://localhost:3000'`）

### ポータルに戻れない
1. ブラウザのホームページが `http://localhost:3000` に設定されているか確認
2. Unified Remoteの `Alt+Home` キー送信が動作しているか確認

---

## 次のフェーズへの準備
Phase 4完了後、以下が使える状態になる：
- Apple TV風ポータルUIがローカルで動作
- 矢印キー＋Enterで操作可能
- 6つのストリーミングサービスをワンタッチ起動
- config.jsonで簡単にサービス追加

→ **Phase 5（Kiosk化・結合テスト・最終仕上げ）** に進む準備完了。
