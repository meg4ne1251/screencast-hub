# Phase 3: 操作環境の構築（Unified Remote）詳細手順書

## 環境情報
- **サーバーソフト:** Unified Remote Server（Windows用）
- **クライアント:** Unified Remote Free（Android）
- **ライセンス:** 無料版で十分（カスタムリモート作成も無料版で可能）
- **操作元:** Androidスマートフォン
- **操作対象:** Windows 11 VM（Phase 1で構築済み）
- **物理リモコン:** 不要（スマホのみで運用）

---

## 無料版 vs 有料版（$4.99）の整理

| 機能 | 無料版 | 有料版 |
|------|--------|--------|
| マウス/キーボード操作 | ○ | ○ |
| メディアコントロール（再生/停止/音量） | ○ | ○ |
| カスタムリモート（Lua/XML） | ○ | ○ |
| Netflix/YouTubeリモート | ○ | ○ |
| 基本リモート 18種 | ○ | 90種以上 |
| フローティングリモート（他アプリの上に重ねて表示） | × | ○ |
| 音声コマンド（「Netflix」と言ってリモート起動） | × | ○ |
| ウィジェット（ホーム画面にボタン配置） | × | ○ |

→ ストリーミングポータルの操作に必要な機能はすべて無料版で使える。

---

## Step 1: 前提条件の確認

Phase 1/2が完了し、以下が動作していること：
- [ ] Windows 11 VMが起動してHDMI出力されている
- [ ] VMのIPアドレスが固定されている
- [ ] Androidスマホが同じネットワークセグメントにいる

---

## Step 2: Unified Remote Serverのインストール（Windows VM側）

### 2-1. ダウンロードとインストール

1. VM内のブラウザで https://www.unifiedremote.com/download にアクセス
2. Windows版インストーラをダウンロード
3. インストールウィザードを実行
   - **「Select Components」画面で「Windows Service」にもチェックを入れる（推奨）**
   - → ログイン画面からでも操作可能になる（VMに物理キーボード/マウスがないので重要）
4. インストール完了後、システムトレイにUnified Remoteアイコンが表示される

### 2-2. ポート構成

| ポート | プロトコル | 用途 |
|--------|-----------|------|
| 9512 | TCP/UDP | メインの通信ポート（クライアント↔サーバー） |
| 9511 | UDP | 自動サーバー発見（LAN内ブロードキャスト） |
| 9510 | TCP | Webマネージャー（ブラウザから設定管理） |

### 2-3. Webマネージャーへのアクセス
```
http://localhost:9510/web
```
ここからサーバー設定、カスタムリモートの管理、接続ログの確認が可能。

---

## Step 3: Windowsファイアウォールの設定

### 3-1. ファイアウォールルールの追加（PowerShell）

管理者権限のPowerShellで実行：

```powershell
# Unified Remote メイン通信
New-NetFirewallRule -DisplayName "Unified Remote - Main (TCP 9512)" `
  -Direction Inbound -Protocol TCP -LocalPort 9512 -Action Allow

New-NetFirewallRule -DisplayName "Unified Remote - Main (UDP 9512)" `
  -Direction Inbound -Protocol UDP -LocalPort 9512 -Action Allow

# 自動サーバー発見
New-NetFirewallRule -DisplayName "Unified Remote - Discovery (UDP 9511)" `
  -Direction Inbound -Protocol UDP -LocalPort 9511 -Action Allow

# Webマネージャー（ローカルアクセスのみ。外部からも使うなら追加）
New-NetFirewallRule -DisplayName "Unified Remote - WebManager (TCP 9510)" `
  -Direction Inbound -Protocol TCP -LocalPort 9510 -Action Allow
```

### 3-2. Proxmox側のファイアウォール
Phase 2と同様、VMレベルでProxmoxファイアウォールを無効化しているなら追加設定は不要。

---

## Step 4: セキュリティ設定

### 4-1. パスワードの設定（推奨）

同一セグメントとはいえ、パスワード設定を推奨。

1. Webマネージャーにアクセス: `http://localhost:9510/web`
2. Settings → Security
3. 「Group Password」にパスワードを設定

または、接続できるデバイスをIPアドレスで制限することも可能。

### 4-2. 自動起動の確認

Unified Remote Serverはインストール時にスタートアップに自動登録される。確認方法：

```powershell
# スタートアップにあるか確認
Get-CimInstance Win32_StartupCommand | Where-Object {
  $_.Name -like "*Unified*"
} | Select-Object Name, Location, Command
```

Windows Serviceとしてインストールした場合：
```powershell
# サービス状態の確認
Get-Service -Name "UnifiedRemote" -ErrorAction SilentlyContinue
```

---

## Step 5: Androidクライアントの設定

### 5-1. インストールと接続

1. Google Play Storeから「Unified Remote」をインストール
2. アプリを起動
3. 同じネットワーク内のサーバーが自動的に検出される
4. VMのホスト名をタップして接続
5. パスワードを設定している場合は入力

### 5-2. このユースケースで使う主要リモート

**日常的に使うリモート：**

| リモート名 | 用途 | 操作 |
|-----------|------|------|
| Basic Input | マウス操作 | タッチパッドでカーソル移動、タップでクリック |
| Keyboard | 文字入力 | スマホキーボードで検索窓に入力 |
| Media | 再生コントロール | 再生/一時停止、音量、次/前 |
| Volume | 音量調整 | スライダーで細かく音量調整 |
| Power | 電源管理 | スリープ、シャットダウン、再起動 |

**ストリーミング用リモート：**

| リモート名 | 用途 |
|-----------|------|
| Netflix (App W10) | Netflixアプリ専用コントロール |
| YouTube (Web) | YouTubeの再生操作 |

### 5-3. 操作のコツ

**物理キーボード/マウスがないVM環境での操作ポイント：**
- Basic Inputリモートの左下にキーボードアイコンがある → タップするとスマホのソフトキーボードが出る
- 二本指スクロール → ページのスクロール
- 長押し → 右クリック
- テキスト入力はBasic Inputのキーボードモードが最も直感的

---

## Step 6: カスタムリモートの作成（ポータル専用リモコン）

Phase 4/5の自作ポータルUIに合わせた専用リモコンを作る。無料版でも作成可能。

### 6-1. カスタムリモートの構成

カスタムリモートは3つのファイルで構成される：

```
C:\ProgramData\Unified Remote\Remotes\Custom\ScreencastHubPortal\
  ├── meta.prop    ← メタデータ（名前、作者、バージョン）
  ├── layout.xml   ← UIレイアウト（ボタン配置）
  └── remote.lua   ← ボタン押下時の動作（Luaスクリプト）
```

### 6-2. meta.prop
```properties
id = ScreencastHubPortal
name = Screencast Hub Portal
author = your-name
version = 1.0
description = ポータル専用リモコン
```

### 6-3. layout.xml
```xml
<?xml version="1.0" encoding="utf-8"?>
<remote>
  <layout>

    <!-- ヘッダー -->
    <row>
      <label text="Screencast Hub Portal" weight="1" />
    </row>

    <!-- ストリーミング起動ボタン -->
    <row>
      <button text="Netflix" icon="film" ontap="launchNetflix" weight="1" />
      <button text="YouTube" icon="play" ontap="launchYouTube" weight="1" />
    </row>
    <row>
      <button text="Prime Video" icon="tv" ontap="launchPrimeVideo" weight="1" />
      <button text="Disney+" icon="star" ontap="launchDisneyPlus" weight="1" />
    </row>

    <!-- ナビゲーション -->
    <row>
      <button text="ポータルに戻る" icon="home" ontap="backToPortal" weight="1" />
    </row>

    <!-- 十字キー操作 -->
    <row>
      <spacer weight="1" />
      <button text="▲" ontap="navUp" weight="1" />
      <spacer weight="1" />
    </row>
    <row>
      <button text="◀" ontap="navLeft" weight="1" />
      <button text="OK" ontap="navSelect" weight="1" />
      <button text="▶" ontap="navRight" weight="1" />
    </row>
    <row>
      <spacer weight="1" />
      <button text="▼" ontap="navDown" weight="1" />
      <spacer weight="1" />
    </row>

    <!-- メディアコントロール -->
    <row>
      <button text="⏮" ontap="mediaPrev" weight="1" />
      <button text="⏯" ontap="mediaPlayPause" weight="1" />
      <button text="⏭" ontap="mediaNext" weight="1" />
    </row>
    <row>
      <button text="🔉" ontap="volDown" weight="1" />
      <button text="ミュート" ontap="volMute" weight="1" />
      <button text="🔊" ontap="volUp" weight="1" />
    </row>

    <!-- 戻る / フルスクリーン -->
    <row>
      <button text="戻る (ESC)" icon="back" ontap="pressEsc" weight="1" />
      <button text="全画面 (F11)" icon="expand" ontap="pressF11" weight="1" />
    </row>

  </layout>
</remote>
```

### 6-4. remote.lua
```lua
-- =========================================
-- Screencast Hub Portal カスタムリモート
-- ストリーミングサービス起動 + ナビゲーション
-- =========================================

local kb = libs.keyboard
local media = libs.media

-- =====================
-- アプリ起動
-- =====================

function launchNetflix()
    -- Netflix Windows アプリを起動
    -- (Microsoft Store版の場合)
    os.start("netflix://")
end

function launchYouTube()
    -- YouTubeをブラウザで開く
    os.start("https://www.youtube.com")
end

function launchPrimeVideo()
    -- Prime Videoをブラウザで開く
    os.start("https://www.amazon.co.jp/gp/video/storefront")
end

function launchDisneyPlus()
    -- Disney+をブラウザで開く
    os.start("https://www.disneyplus.com")
end

function backToPortal()
    -- Kioskブラウザのポータルページに戻る
    -- Alt+Homeでブラウザのホームページに戻る
    kb.stroke("alt", "home")
end

-- =====================
-- 十字キーナビゲーション
-- （ポータルUIのフォーカス操作用）
-- =====================

function navUp()
    kb.stroke("up")
end

function navDown()
    kb.stroke("down")
end

function navLeft()
    kb.stroke("left")
end

function navRight()
    kb.stroke("right")
end

function navSelect()
    kb.stroke("return")
end

-- =====================
-- メディアコントロール
-- =====================

function mediaPlayPause()
    kb.stroke("space")
end

function mediaNext()
    media.next()
end

function mediaPrev()
    media.previous()
end

-- =====================
-- 音量
-- =====================

function volUp()
    media.volume_up()
end

function volDown()
    media.volume_down()
end

function volMute()
    media.volume_mute()
end

-- =====================
-- ユーティリティ
-- =====================

function pressEsc()
    kb.stroke("escape")
end

function pressF11()
    kb.stroke("f11")
end
```

### 6-5. カスタムリモートのインストール

1. 上記3ファイルを以下のフォルダに配置：
   ```
   C:\ProgramData\Unified Remote\Remotes\Custom\ScreencastHubPortal\
   ```

2. Unified Remote Serverを再起動（トレイアイコン右クリック → Restart）

3. Androidアプリ側でリモート一覧をリフレッシュ → 「Screencast Hub Portal」が表示される

### 6-6. カスタマイズのポイント

**URIスキームについて：**
- `netflix://` → Netflix Windowsアプリを直接起動
- 他のサービスはブラウザで開く形（URLを変更するだけで対応サービスを追加可能）
- Phase 4でポータルUIにURIスキームを実装した際に、このLuaスクリプトも合わせて更新する

**ボタン追加の手順：**
layout.xmlに `<button>` を追加し、remote.luaに対応する関数を書くだけ。サーバー再起動で反映される。

---

## Step 7: 音声入力について（補足）

Unified Remoteの音声機能は「音声コマンド」（リモート名やアクション名を声で指示）であり、**テキスト入力への音声ディクテーションではない**。

検索窓への文字入力を楽にするには：
1. **Basic Inputリモートのキーボード** → スマホのソフトキーボード（音声入力対応）を使う
2. **Windows 11のネイティブ音声入力** → Win+H でWindows側の音声入力を起動するカスタムボタンを追加可能：
```lua
function voiceTyping()
    kb.stroke("lwin", "h")  -- Windows + H で音声入力を起動
end
```

---

## Step 8: 動作確認チェックリスト

- [ ] Unified Remote Serverがインストールされ、トレイに常駐している
- [ ] Webマネージャー（http://localhost:9510/web）にアクセスできる
- [ ] ファイアウォールルール（TCP/UDP 9512, UDP 9511）が適用されている
- [ ] パスワードが設定されている
- [ ] Androidアプリがサーバーを自動検出して接続できる
- [ ] Basic Inputリモートでマウス操作ができる
- [ ] Keyboardリモートで文字入力ができる
- [ ] Mediaリモートで再生/一時停止/音量調整ができる
- [ ] カスタムリモート「Screencast Hub Portal」が表示される
- [ ] Netflixボタンでアプリが起動する
- [ ] YouTubeボタンでブラウザが開く
- [ ] 十字キーナビゲーションが動作する
- [ ] VM再起動後もUnified Remote Serverが自動起動する

---

## トラブルシューティング

### サーバーが発見されない
1. AndroidとVMが同じサブネットにいるか確認
2. UDP 9511（ディスカバリ）がファイアウォールで許可されているか確認
3. 手動接続: アプリ内でVMのIPアドレスを直接入力

### 接続はできるがマウスが動かない
1. VM側でリモートデスクトップセッションがアクティブだと干渉する場合がある → RDPを切断
2. Windows Serviceモードでインストールしているか確認

### カスタムリモートが表示されない
1. フォルダパスが正しいか確認: `C:\ProgramData\Unified Remote\Remotes\Custom\ScreencastHubPortal\`
2. meta.propの`id`が一意であるか確認
3. Unified Remote Serverを再起動
4. Androidアプリのリモート一覧を下にスワイプしてリフレッシュ

### os.start()でアプリが起動しない
1. パスが正しいか確認（バックスラッシュはダブル `\\` にエスケープ）
2. URIスキーム（netflix://）が登録されているか確認
3. Luaの関数名がlayout.xmlのontap属性と一致しているか確認

---

## 次のフェーズへの準備
Phase 3完了後、以下が使える状態になる：
- Androidスマホ1台でWindows VMを完全操作可能
- カスタムリモート「Screencast Hub Portal」でストリーミングアプリを一発起動
- 十字キー操作でポータルUIをナビゲーション
- メディアコントロール（再生/停止/音量）

→ **Phase 4（自作ポータルUI開発）** に進む準備完了。
→ Phase 4のフォーカス制御（十字キー＋Enter操作）と、このカスタムリモートのキー送信が連動する設計。
