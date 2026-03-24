import { useState, useEffect, useCallback, useRef } from "react";

// === サービス設定（config.json相当） ===
// 実際のデプロイ時はこれを外部JSONファイルに切り出し、fetch()で読み込む
const DEFAULT_SERVICES = [
  {
    id: "netflix",
    name: "Netflix",
    color: "#E50914",
    icon: "🎬",
    launchUrl: "netflix://",
    fallbackUrl: "https://www.netflix.com",
    description: "映画・ドラマ",
  },
  {
    id: "youtube",
    name: "YouTube",
    color: "#FF0000",
    icon: "▶",
    launchUrl: "https://www.youtube.com",
    fallbackUrl: "https://www.youtube.com",
    description: "動画",
  },
  {
    id: "prime-video",
    name: "Prime Video",
    color: "#00A8E1",
    icon: "📺",
    launchUrl: "https://www.amazon.co.jp/gp/video/storefront",
    fallbackUrl: "https://www.amazon.co.jp/gp/video/storefront",
    description: "映画・ドラマ・アニメ",
  },
  {
    id: "unext",
    name: "U-NEXT",
    color: "#00B900",
    icon: "🎞",
    launchUrl: "https://video.unext.jp",
    fallbackUrl: "https://video.unext.jp",
    description: "映画・ドラマ・アニメ",
  },
  {
    id: "fod",
    name: "FOD",
    color: "#FF6B00",
    icon: "📡",
    launchUrl: "https://fod.fujitv.co.jp",
    fallbackUrl: "https://fod.fujitv.co.jp",
    description: "フジテレビ見逃し",
  },
  {
    id: "abema",
    name: "ABEMA",
    color: "#33CC33",
    icon: "📱",
    launchUrl: "https://abema.tv",
    fallbackUrl: "https://abema.tv",
    description: "ニュース・アニメ・バラエティ",
  },
];

// === 時計コンポーネント ===
function Clock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours().toString().padStart(2, "0");
  const minutes = time.getMinutes().toString().padStart(2, "0");
  const dateStr = time.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <div style={{ textAlign: "right" }}>
      <div
        style={{
          fontSize: "48px",
          fontWeight: "200",
          letterSpacing: "4px",
          lineHeight: 1,
        }}
      >
        {hours}:{minutes}
      </div>
      <div
        style={{
          fontSize: "16px",
          opacity: 0.6,
          marginTop: "4px",
          fontWeight: "300",
        }}
      >
        {dateStr}
      </div>
    </div>
  );
}

// === サービスカード ===
function ServiceCard({ service, isFocused, onSelect }) {
  const cardRef = useRef(null);

  useEffect(() => {
    if (isFocused && cardRef.current) {
      cardRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [isFocused]);

  return (
    <div
      ref={cardRef}
      onClick={() => onSelect(service)}
      style={{
        width: "220px",
        height: "140px",
        borderRadius: "18px",
        background: isFocused
          ? `linear-gradient(135deg, ${service.color}dd, ${service.color}88)`
          : `linear-gradient(135deg, ${service.color}66, ${service.color}33)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: isFocused ? "scale(1.12)" : "scale(1)",
        boxShadow: isFocused
          ? `0 12px 40px ${service.color}66, 0 0 0 3px rgba(255,255,255,0.4)`
          : "0 4px 12px rgba(0,0,0,0.3)",
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
        zIndex: isFocused ? 10 : 1,
      }}
    >
      {/* グラスモーフィズム的な光沢 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "50%",
          background: isFocused
            ? "linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 100%)"
            : "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)",
          borderRadius: "18px 18px 0 0",
          transition: "all 0.25s ease",
        }}
      />
      <div
        style={{
          fontSize: "42px",
          marginBottom: "8px",
          filter: isFocused ? "none" : "grayscale(20%)",
          transition: "all 0.25s ease",
        }}
      >
        {service.icon}
      </div>
      <div
        style={{
          fontSize: "18px",
          fontWeight: "600",
          color: "white",
          letterSpacing: "0.5px",
        }}
      >
        {service.name}
      </div>
      <div
        style={{
          fontSize: "11px",
          color: "rgba(255,255,255,0.7)",
          marginTop: "2px",
          fontWeight: "300",
        }}
      >
        {service.description}
      </div>
    </div>
  );
}

// === メインポータル ===
export default function YamatoPortal() {
  const [services] = useState(DEFAULT_SERVICES);
  const [focusIndex, setFocusIndex] = useState(0);
  const [launched, setLaunched] = useState(null);
  const columns = 3;

  // キーボードナビゲーション
  const handleKeyDown = useCallback(
    (e) => {
      const total = services.length;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          setFocusIndex((prev) => (prev + 1) % total);
          break;
        case "ArrowLeft":
          e.preventDefault();
          setFocusIndex((prev) => (prev - 1 + total) % total);
          break;
        case "ArrowDown":
          e.preventDefault();
          setFocusIndex((prev) => Math.min(prev + columns, total - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusIndex((prev) => Math.max(prev - columns, 0));
          break;
        case "Enter":
          e.preventDefault();
          handleSelect(services[focusIndex]);
          break;
        case "Escape":
          e.preventDefault();
          setLaunched(null);
          break;
        default:
          break;
      }
    },
    [services, focusIndex, columns]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleSelect = (service) => {
    setLaunched(service);
    // 実際のデプロイ時: window.location.href = service.launchUrl
    // またはローカルAPIサーバー経由でアプリを起動
    setTimeout(() => setLaunched(null), 3000);
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "linear-gradient(160deg, #0a0a0f 0%, #1a1a2e 40%, #16213e 100%)",
        color: "white",
        fontFamily:
          "'SF Pro Display', 'Hiragino Sans', 'Yu Gothic UI', -apple-system, BlinkMacSystemFont, sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* 背景の装飾的なグラデーション球体 */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          right: "-10%",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-30%",
          left: "-10%",
          width: "500px",
          height: "500px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(139, 92, 246, 0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* ヘッダー */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "40px 60px 20px",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: "600",
              margin: 0,
              letterSpacing: "-0.5px",
              background: "linear-gradient(135deg, #ffffff 0%, #a0a0b0 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Yamato Display
          </h1>
          <p
            style={{
              fontSize: "14px",
              opacity: 0.4,
              margin: "4px 0 0",
              fontWeight: "300",
            }}
          >
            Media Center
          </p>
        </div>
        <Clock />
      </div>

      {/* サービスグリッド */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 60px",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, 220px)`,
            gap: "28px",
            justifyContent: "center",
          }}
        >
          {services.map((service, index) => (
            <ServiceCard
              key={service.id}
              service={service}
              isFocused={focusIndex === index}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </div>

      {/* フォーカスインジケーター */}
      <div
        style={{
          textAlign: "center",
          padding: "20px 0 40px",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
          {services.map((_, i) => (
            <div
              key={i}
              style={{
                width: focusIndex === i ? "24px" : "8px",
                height: "8px",
                borderRadius: "4px",
                background:
                  focusIndex === i
                    ? "rgba(255,255,255,0.9)"
                    : "rgba(255,255,255,0.2)",
                transition: "all 0.3s ease",
              }}
            />
          ))}
        </div>
        <p
          style={{
            fontSize: "13px",
            opacity: 0.3,
            fontWeight: "300",
          }}
        >
          ← → ↑ ↓ で選択 &nbsp;&nbsp; Enter で起動 &nbsp;&nbsp; ESC で戻る
        </p>
      </div>

      {/* 起動オーバーレイ */}
      {launched && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            zIndex: 100,
            animation: "fadeIn 0.3s ease",
          }}
        >
          <div
            style={{
              fontSize: "72px",
              marginBottom: "20px",
              animation: "pulse 1.5s infinite",
            }}
          >
            {launched.icon}
          </div>
          <div
            style={{
              fontSize: "28px",
              fontWeight: "600",
              marginBottom: "8px",
            }}
          >
            {launched.name}
          </div>
          <div
            style={{
              fontSize: "16px",
              opacity: 0.5,
              fontWeight: "300",
            }}
          >
            起動中...
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow: hidden; }
      `}</style>
    </div>
  );
}
