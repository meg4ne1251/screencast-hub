# Phase 2: キャスト環境の構築（AirPlay / Chromecast）詳細手順書

## 環境情報
- **キャストソフト:** AirServer Windows Desktop Edition v5.7.x
- **ライセンス:** Consumer License $19.99（買い切り）/ 30日無料トライアルあり
- **対応プロトコル:** AirPlay 2 + Google Cast + Miracast（同時対応）
- **キャスト元:** MacBook（AirPlay）、Androidスマートフォン（Google Cast）
- **ネットワーク:** 同一セグメント（VLAN分離なし）
- **受信先:** Windows 11 VM（Phase 1で構築済み）

---

## Step 1: 前提条件の確認

Phase 1が完了し、以下が動作していること：
- [ ] Windows 11 VMがGPU経由でプロジェクターに映像出力されている
- [ ] VMのIPアドレスが固定されている
- [ ] VMにネットワーク経由でRDPアクセスできる
- [ ] MacBookとAndroidが同じネットワークセグメントにいる

---

## Step 2: Bonjour（mDNS）サービスのインストール

AirPlayとGoogle Castの**デバイス発見**にはmDNS（Bonjour）が必須。AirServerにはBonjourが同梱されていないため、別途インストールする。

### 2-1. Bonjourのインストール方法

**方法A: iTunes経由（推奨）**
iTunesをインストールすると、Bonjourサービスが一緒に入る。
1. Microsoft StoreからiTunesをインストール
2. インストール後、`mDNSResponder.exe` がサービスとして常駐していることを確認

**方法B: Bonjour Print Services**
iTunesを入れたくない場合：
1. Appleの公式サイトから「Bonjour Print Services for Windows」をダウンロード
2. インストール（Bonjourサービスのみが入る）

### 2-2. Bonjourの動作確認
```powershell
# サービスが起動しているか確認
Get-Service -Name "Bonjour Service"

# mDNSResponder.exeが動いているか確認
Get-Process -Name mDNSResponder
```

Status が `Running` であればOK。

---

## Step 3: Windowsファイアウォールの設定

AirPlayとGoogle Castの通信に必要なポートを開放する。

### 3-1. AirPlay用ポート

| プロトコル | ポート | 用途 |
|-----------|--------|------|
| UDP | 5353 | mDNS（Bonjour デバイス発見） |
| TCP | 5000-5001 | AirPlay 制御チャネル |
| TCP | 7000 | AirPlay 映像ストリーミング |
| TCP/UDP | 7100 | AirPlay スクリーンミラーリング |
| TCP/UDP | 49152-65535 | ダイナミックセッションポート |

### 3-2. Google Cast用ポート

| プロトコル | ポート | 用途 |
|-----------|--------|------|
| UDP | 5353 | mDNS（デバイス発見） |
| UDP | 1900 | SSDP（レガシー DIAL ディスカバリ） |
| TCP | 8008-8009 | Google Cast ストリーミング |
| TCP/UDP | 32768-65535 | ダイナミックポート |

### 3-3. ファイアウォールルールの一括追加（PowerShell）

管理者権限のPowerShellで実行：

```powershell
# === AirPlay 関連 ===

# mDNS (Bonjour) - AirPlayとGoogle Cast共通
New-NetFirewallRule -DisplayName "AirServer - mDNS (UDP 5353)" `
  -Direction Inbound -Protocol UDP -LocalPort 5353 -Action Allow

# AirPlay制御チャネル
New-NetFirewallRule -DisplayName "AirServer - AirPlay Control (TCP 5000-5001)" `
  -Direction Inbound -Protocol TCP -LocalPort 5000-5001 -Action Allow

# AirPlay映像ストリーミング
New-NetFirewallRule -DisplayName "AirServer - AirPlay Video (TCP 7000)" `
  -Direction Inbound -Protocol TCP -LocalPort 7000 -Action Allow

# AirPlayスクリーンミラーリング
New-NetFirewallRule -DisplayName "AirServer - AirPlay Mirror (TCP 7100)" `
  -Direction Inbound -Protocol TCP -LocalPort 7100 -Action Allow
New-NetFirewallRule -DisplayName "AirServer - AirPlay Mirror (UDP 7100)" `
  -Direction Inbound -Protocol UDP -LocalPort 7100 -Action Allow

# === Google Cast 関連 ===

# SSDP (DIAL ディスカバリ)
New-NetFirewallRule -DisplayName "AirServer - SSDP (UDP 1900)" `
  -Direction Inbound -Protocol UDP -LocalPort 1900 -Action Allow

# Google Cast ストリーミング
New-NetFirewallRule -DisplayName "AirServer - Google Cast (TCP 8008-8009)" `
  -Direction Inbound -Protocol TCP -LocalPort 8008-8009 -Action Allow

# === 共通: ダイナミックポート ===
New-NetFirewallRule -DisplayName "AirServer - Dynamic Ports (TCP)" `
  -Direction Inbound -Protocol TCP -LocalPort 49152-65535 -Action Allow
New-NetFirewallRule -DisplayName "AirServer - Dynamic Ports (UDP)" `
  -Direction Inbound -Protocol UDP -LocalPort 49152-65535 -Action Allow
```

### 3-4. Proxmox側のファイアウォール確認
Proxmoxのファイアウォールがデフォルトで有効になっている場合、VMのネットワーク設定でも上記ポートを許可する必要がある。

```
Proxmox WebUI → VM <VMID> → Firewall → Add Rule
```
または、VMレベルでファイアウォールを無効化（同一セグメントなのでリスクは低い）：
```
Proxmox WebUI → VM <VMID> → Firewall → Options → Firewall: No
```

---

## Step 4: AirServerのインストールと設定

### 4-1. インストール
1. https://www.airserver.com/WindowsDesktop にアクセス
2. 「Free Trial」または購入してインストーラをダウンロード
3. インストール実行
4. ライセンスキーの入力（またはトライアル開始）

### 4-2. 基本設定

**デバイス名の設定（AirServerConsole CLI）：**
```cmd
airserverconsole set DeviceName "<任意のデバイス名>"
```
→ MacBookやAndroidのキャスト先一覧に指定した名前が表示される。

**フルスクリーン表示のデフォルト化：**
```cmd
airserverconsole set DefaultFullScreen ON
```
→ キャスト受信時に自動で全画面表示になる。

**解像度設定：**
AirServerの設定画面から：
- AirPlay品質: 「Retina Quality」を有効化（1080p相当）
- Google Cast品質: 最大解像度を選択

### 4-3. スタートアップ登録（自動起動）

**方法A: AirServer内蔵の自動起動設定**
AirServer設定 → General → 「Start AirServer on login」にチェック

**方法B: スタートアップフォルダに配置**
```powershell
# AirServerのショートカットをスタートアップフォルダにコピー
$startupPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
$airserverExe = "C:\Program Files\AirServer\AirServer.exe"

# ショートカット作成
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut("$startupPath\AirServer.lnk")
$shortcut.TargetPath = $airserverExe
$shortcut.Arguments = "/tray"
$shortcut.WindowStyle = 7  # Minimized
$shortcut.Save()
```
`/tray` オプションで、タスクトレイに最小化状態で起動させる。

### 4-4. 認証設定（セキュリティ）

同一セグメントに信頼できるデバイスしかない場合は認証なしでOK。外部からのアクセスが心配な場合：

```cmd
# PIN認証を有効化（初回接続時にPINを表示）
airserverconsole set AirPlaySecurityType PINFirstTime

# またはパスワード認証
airserverconsole set AirPlaySecurityType Password
airserverconsole set AirPlayPassword "YourPassword"
```

---

## Step 5: キャストテスト

### 5-1. AirPlayテスト（MacBook → VM）

1. MacBookの画面右上、コントロールセンター → 「画面ミラーリング」をクリック
2. 設定したデバイス名が一覧に表示されることを確認
3. クリックしてミラーリング開始
4. プロジェクター上にMacBookの画面が表示されることを確認

**チェック項目：**
- [ ] デバイスが発見される（Bonjourが正常動作）
- [ ] ミラーリングが開始される
- [ ] 映像が遅延なく表示される（GPUパススルー環境で）
- [ ] 音声も転送される
- [ ] 1080p品質で表示される
- [ ] ミラーリング解除後、AirServerが待機状態に戻る

### 5-2. Google Castテスト（Android → VM）

1. Androidの設定 → 接続済みのデバイス → キャスト（またはクイック設定から「キャスト」）
2. 設定したデバイス名が一覧に表示されることを確認
3. タップしてキャスト開始
4. プロジェクター上にAndroidの画面が表示されることを確認

**チェック項目：**
- [ ] デバイスが発見される（mDNS / SSDP正常動作）
- [ ] 画面キャストが開始される
- [ ] YouTube等のアプリからの直接キャスト（メディアキャスト）も動作する
- [ ] キャスト解除後、AirServerが待機状態に戻る

### 5-3. 同時キャストテスト
AirServerは最大9台の同時キャストに対応。以下をテスト：
1. MacBookのAirPlayミラーリング中に、AndroidからGoogle Castを開始
2. 画面が分割表示されるか確認
3. 片方を切断したとき、もう片方がフルスクリーンに戻るか確認

---

## Step 6: ポータルUI連携の準備（Phase 4/5に向けて）

### 6-1. キャスト受信時のウィンドウ挙動

AirServerはキャスト受信時に自前のウィンドウを最前面に表示する。Phase 5のKioskモードブラウザとの共存について：

**想定される挙動フロー：**
```
通常時:    [Kioskブラウザ（ポータルUI）] ← 最前面
             ↓ AirPlayキャスト受信
キャスト中: [AirServerフルスクリーン] ← 最前面に割り込み
             ↓ キャスト終了
復帰:      [Kioskブラウザ] ← 自動復帰？ → 要テスト
```

**課題と解決策：**
キャスト終了後にKioskブラウザが自動で最前面に戻らない可能性がある。以下の対策を検討：

**案A: AirServer Connect APIでイベント監視**
AirServerのConnect APIを使い、キャスト開始/終了イベントをフックして、終了時にKioskブラウザをフォアグラウンドに戻すスクリプトを作る。

**案B: 常駐監視スクリプト（PowerShell / Python）**
```powershell
# 簡易版: AirServerのウィンドウ状態を監視し、
# キャスト終了を検知したらKioskブラウザをフォアグラウンドに戻す
while ($true) {
    $airserverWindow = Get-Process -Name AirServer -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowTitle -ne "" }

    if (-not $airserverWindow) {
        # AirServerがアクティブでない → ブラウザを前面に
        $browser = Get-Process -Name msedge -ErrorAction SilentlyContinue |
            Where-Object { $_.MainWindowTitle -ne "" } | Select-Object -First 1
        if ($browser) {
            [void][System.Runtime.InteropServices.Marshal]::GetActiveObject("Shell.Application")
            # ブラウザウィンドウをフォアグラウンドに
        }
    }
    Start-Sleep -Seconds 2
}
```
※ 実装はPhase 5で詳細化する。ここでは挙動テストのみ。

**案C: AirServerを「ウィンドウモード」で使い、OBS等で合成**
より高度だが、OBSのシーン切り替えでキャスト画面とポータルUIを管理する方法。オーバーキルなので必要に応じて検討。

### 6-2. 音響環境との連携

計画書にある「音響環境にも自動接続するとベスト」について：
- AirServerはAirPlay経由の音声をWindows側のデフォルトオーディオ出力に流す
- GPUのHDMI Audio（パススルー済み）を利用すれば、プロジェクターの内蔵スピーカーから音が出る
- 外部スピーカーを使う場合は、Windowsのサウンド設定でデフォルト出力先を変更

---

## Step 7: 動作確認チェックリスト

- [ ] Bonjourサービスが起動している
- [ ] AirServerがインストールされ、ライセンス認証済み
- [ ] デバイス名が任意の名前に設定されている
- [ ] フルスクリーン表示がデフォルト化されている
- [ ] AirServerがスタートアップに登録されている
- [ ] ファイアウォールルールが適用されている
- [ ] MacBookからAirPlayでミラーリングできる
- [ ] AndroidからGoogle Castで画面キャストできる
- [ ] YouTubeなどのメディアキャスト（個別アプリ内キャスト）が動作する
- [ ] 音声がプロジェクター（またはスピーカー）から出力される
- [ ] キャスト解除後にAirServerが待機状態に戻る
- [ ] VM再起動後、AirServerが自動起動してキャスト受信可能になる

---

## トラブルシューティング

### デバイスが発見されない
1. Bonjourサービスが起動しているか確認（`Get-Service "Bonjour Service"`）
2. ファイアウォールでUDP 5353が許可されているか確認
3. VMとキャスト元が同じサブネットにいるか確認（`ipconfig` で確認）
4. Proxmox側のファイアウォールが通信をブロックしていないか確認

### AirPlayは発見されるがGoogle Castが見つからない
1. UDP 1900（SSDP）が許可されているか確認
2. AirServerの設定でGoogle Castが有効になっているか確認
3. Androidのキャスト画面で「デバイスを検索中...」のまま進まない場合、Androidを再起動

### 映像が途切れる・遅延が大きい
1. ネットワーク帯域を確認（Wi-Fiの場合、5GHz帯を使用しているか）
2. AirServerの解像度設定を下げてみる
3. GPUドライバが正常に動作しているか確認（デバイスマネージャー）

### 音声が出ない
1. Windowsのサウンド設定でデフォルト出力がHDMI（GPU）になっているか確認
2. AirServerの音声設定を確認
3. プロジェクター側のボリュームが0でないか確認

---

## 次のフェーズへの準備
Phase 2完了後、以下が使える状態になる：
- MacBookからAirPlayでプロジェクターに画面をミラーリング
- AndroidからGoogle Castでプロジェクターに画面をキャスト
- キャストが全画面で自動表示される
- VM再起動後も自動的にキャスト受信可能

→ **Phase 3（Unified Remote 操作環境）** に進む準備完了。
