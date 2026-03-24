# Phase 1: 基盤構築 詳細実装手順書

## 環境情報
- **サーバー:** タワー型サーバー（Intel VT-d対応）
- **ハイパーバイザ:** Proxmox VE（稼働中）
- **GPU:** NVIDIA製GPU（PCIeパススルー対応モデル）
- **ゲストOS:** Windows 11 VM

---

## Step 1: BIOS設定（HPE ProLiant タワーサーバー固有）

サーバー起動時にF9キーでRBSU（UEFI設定）に入り、以下を設定する。

### 1-1. Intel VT-dの有効化
```
System Utilities
  → System Configuration
    → BIOS/Platform Configuration (RBSU)
      → System Options
        → Virtualization Options
          → Intel(R) VT-d → 「Enabled」
```

### 1-2. ビデオ出力の優先設定
GPUパススルーの競合を防ぐため、内蔵グラフィックを優先に設定する。
```
System Options
  → Embedded Video
    → 「Embedded video primary, optional video secondary」
```
※ これにより、GPUがファームウェア初期化で使われず、VMに完全パススルーできる。

### 1-3. PCI Express 64bit BAR Supportの有効化
```
Service Options
  → PCI Express 64bit BAR Support → 「Enabled」
```

### 1-4. BIOS ファームウェアの更新（推奨）
HPEのサポートサイトから最新のBIOSを確認し、古い場合はアップデートする。古いファームウェアにはIOMMU関連の既知バグがある。

---

## Step 2: Proxmox ホスト側の設定

### 2-1. GRUBの設定
```bash
nano /etc/default/grub
```
以下のように変更：
```
GRUB_CMDLINE_LINUX_DEFAULT="quiet intel_iommu=on iommu=pt initcall_blacklist=sysfb_init"
```

**HPE固有: カーネル6.8以降でIOMMUエラーが出る場合は以下を追加：**
```
GRUB_CMDLINE_LINUX_DEFAULT="quiet intel_iommu=on iommu=pt initcall_blacklist=sysfb_init pcie_acs_override=downstream,multifunction relax_rmrr"
```

適用：
```bash
update-grub
reboot
```

### 2-2. カーネルモジュールの読み込み
```bash
nano /etc/modules
```
以下を追記：
```
vfio
vfio_iommu_type1
vfio_pci
vfio_virqfd
```

### 2-3. NVIDIAドライバのブラックリスト化（ホスト側で使わせない）
```bash
nano /etc/modprobe.d/blacklist.conf
```
以下を追記：
```
blacklist nouveau
blacklist nvidia
blacklist nvidiafb
blacklist nvidia_drm
```

### 2-4. GPUのPCIアドレスとIOMMUグループの確認
```bash
# GPUのPCIアドレスを確認
lspci -v | grep -i nvidia

# デバイスID（vendor:device）を確認
lspci -nn | grep -i nvidia
```
出力例（環境によって異なる）：
```
XX:00.0 VGA compatible controller: NVIDIA Corporation [GPU名] [XXXX:XXXX]
XX:00.1 Audio device: NVIDIA Corporation [Audio名] [XXXX:XXXX]
```

IOMMUグループを確認：
```bash
for d in /sys/kernel/iommu_groups/*/devices/*; do
  n=${d#*/iommu_groups/*}; n=${n%%/*}
  printf 'IOMMU group %s ' "$n"
  lspci -nns "${d##*/}"
done
```
→ GPUのVGAとAudioが同じIOMMUグループにいることを確認。

### 2-5. VFIO-PCIの設定
```bash
nano /etc/modprobe.d/vfio.conf
```
上記の `lspci -nn` で確認したデバイスIDを指定（例）：
```
options vfio-pci ids=XXXX:XXXX,XXXX:XXXX
```

適用して再起動：
```bash
update-initramfs -u
reboot
```

### 2-6. パススルーの確認
再起動後、GPUがvfio-pciにバインドされていることを確認：
```bash
lspci -nnk -s XX:00  # XX は実際のPCIアドレスに置き換える
```
「Kernel driver in use: vfio-pci」と表示されればOK。

---

## Step 3: HPE固有の追加設定（必要な場合）

### 3-1. conrepユーティリティによるRMRDS設定
Step 2までで問題なく動作すればスキップしてよい。IOMMUマッピングエラーが出る場合のみ実施。

HPE Scripting Toolsをインストール後、GPUが刺さっているスロットのRMRDS（Reserved Memory Region Device Scope）を除外設定する：

```bash
# conrepの設定ファイルを作成し、GPUスロットをExcluded設定にする
conrep -l -x conrep_rmrds.xml -f exclude.dat
conrep -s -x conrep_rmrds.xml -f verify.dat
```

### 3-2. 代替手段: relax_rmrr カーネルパラメータ
conrepが煩雑な場合は、Step 2-1のGRUBに `relax_rmrr` を追加する方法で対処可能。

---

## Step 4: Windows 11 VMの作成

### 4-1. VM作成（Proxmox WebUIまたはCLI）

**推奨設定値：**
| 項目 | 設定値 | 備考 |
|------|--------|------|
| Machine Type | q35 | PCIeネイティブ対応。i440fxは非推奨 |
| BIOS | OVMF (UEFI) | Win11はUEFI必須 |
| CPU Type | host | パフォーマンス最大化 |
| Cores | 4〜6 | 動画再生・UI操作に十分 |
| Memory | 8192 MB (8GB) | 動画再生+ブラウザKioskに十分 |
| Disk | 150GB（SSD推奨） | OS + アプリ分 |
| Network | virtio | 最高性能のNIC |
| TPM | v2.0 | Win11要件 |
| Display | none | GPUパススルー時は無効にする |

CLI例：
```bash
qm create <VMID> --name <VM名> --agent 1 \
  --memory 8192 --bios ovmf \
  --sockets 1 --cores 4 --cpu host \
  --net0 virtio,bridge=vmbr0 \
  --scsihw virtio-scsi-single \
  --ostype win11 \
  --efidisk0 local-lvm:0 \
  --tpmstate0 local-lvm:0,version=v2.0 \
  --scsi0 local-lvm:150 \
  --machine q35
```

### 4-2. GPUパススルーの設定 + Error 43回避

VM設定ファイルを直接編集：
```bash
nano /etc/pve/qemu-server/<VMID>.conf
```

以下を追加：
```
# GPUパススルー（VGAとAudioの両方）
hostpci0: XX:00.0,pcie=1,x-vga=1  # 実際のPCIアドレスに置き換える
hostpci1: XX:00.1,pcie=1

# ディスプレイ無効化（GPU出力のみ使用）
display: none

# Error 43 回避: ハイパーバイザ隠蔽 + ベンダーID偽装
cpu: host,hidden=1,flags=+pcid
args: -cpu 'host,+kvm_pv_unhalt,+kvm_pv_eoi,hv_vendor_id=NV43FIX,kvm=off'
```

**各パラメータの意味：**
- `hidden=1` → NVIDIAドライバにVM環境であることを隠す
- `hv_vendor_id=NV43FIX` → Hyper-Vのベンダー識別を偽装
- `kvm=off` → KVM CPUIDを隠蔽
- `x-vga=1` → このGPUをプライマリVGA出力として使用

### 4-3. Windows 11インストール

1. Win11 ISOとVirtIOドライバISOをアップロードしてCDROMにマウント
2. 初回インストール時はdisplayを一時的に `vnc` に変更してリモートコンソールから操作
3. インストール完了後、NVIDIAドライバをインストール
4. ドライバインストール後にdisplayを `none` に戻す
5. 以降はHDMI出力（プロジェクター接続）のみで操作

### 4-4. Windows 11 自動サインイン設定

**方法A: Sysinternals Autologon（推奨・暗号化される）**
1. Autologon.exeをダウンロード
2. 管理者権限で実行し、ユーザー名とパスワードを入力
3. パスワードはLSAシークレットとして暗号化保存される

**方法B: レジストリ直接編集**
```
Win+R → regedit
HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon
```
- `AutoAdminLogon` → 文字列 `1`
- `DefaultUserName` → ユーザー名
- `DefaultPassword` → パスワード（※平文保存のため注意）

**Windows 11 24H2の場合の追加手順：**
Credential Guardが自動ログインを阻害する場合：
```
reg add "HKLM\System\CurrentControlSet\Control\Lsa" /v "LsaCfgFlags" /t REG_DWORD /d 0
```

---

## Step 5: ネットワーク設定

### 5-1. VMのIPアドレス固定化
Windows VM内でIPアドレスを固定する：
- 設定 → ネットワークとインターネット → イーサネット → IP設定の編集

または、Proxmoxのルーター/DHCPサーバー側でMACアドレスベースの固定割当を設定。

### 5-2. NetBoxへのドキュメント化（計画に記載あり）
以下の情報をNetBoxに登録：
- VMのIP: (固定IPを記録)
- PCIeパススルー情報: GPU → スロット番号、IOMMUグループ番号
- VM ID: (使用したVMIDを記録)

---

## Step 6: 動作確認チェックリスト

- [ ] BIOS設定（VT-d有効、Embedded Video Primary、64bit BAR）
- [ ] GRUB設定適用済み（intel_iommu=on, iommu=pt）
- [ ] vfio-pciモジュール読み込み確認
- [ ] NVIDIAドライバのブラックリスト確認
- [ ] GPUがvfio-pciにバインドされている
- [ ] Windows 11 VMが起動する
- [ ] GPUパススルーでHDMI出力がプロジェクターに映る
- [ ] NVIDIAドライバインストール後にError 43が出ない
- [ ] Windows 11の自動サインインが動作する
- [ ] ネットワーク経由でVMにアクセスできる（RDP等）
- [ ] Netflix/YouTube等でDRM保護コンテンツが高画質で再生される

---

## トラブルシューティング

### Error 43が出る場合
1. `hidden=1` と `hv_vendor_id` の設定を再確認
2. Secure Bootを無効化してみる
3. displayが `none` になっているか確認（vncやspiceが残っているとNG）
4. 最終手段: VBIOSパッチ（nvidia-kvm-patcher等）

### VMが起動しない/ハングする場合
1. IOMMUグループの確認（不要なデバイスが含まれていないか）
2. HPE固有: `relax_rmrr` カーネルパラメータを追加
3. `pcie_acs_override=downstream,multifunction` を試す

### HDMI出力が映らない場合
1. プロジェクター側の入力ソースがHDMIになっているか確認
2. `x-vga=1` の設定を確認
3. ケーブルの接続確認（長距離の場合はアクティブケーブル推奨）

---

## 次のフェーズへの準備
Phase 1完了後、以下が使える状態になる：
- Windows 11 VMがGPU経由でプロジェクターに映像出力
- 自動サインインでパスワード入力不要
- ネットワーク経由でVMに到達可能

→ **Phase 2（AirPlay/Chromecast受信環境）** と **Phase 3（Unified Remote）** に進む準備完了。
