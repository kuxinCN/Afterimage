"use client";

// Replaces the root layout when it throws, so it must ship its own html/body
// and cannot rely on globals.css having loaded.
export default function GlobalError({ error, reset }) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0a09",
          color: "#e6ddce",
          fontFamily: "var(--font-geist-sans), Arial, Helvetica, sans-serif",
          padding: "24px",
        }}
      >
        <section
          style={{
            maxWidth: "420px",
            width: "100%",
            textAlign: "center",
            border: "1px solid rgba(230,213,176,0.12)",
            borderRadius: "16px",
            background: "rgba(18,16,13,0.7)",
            padding: "40px 24px",
          }}
        >
          <p style={{ fontSize: "12px", letterSpacing: "0.28em", color: "#8d8474" }}>
            AFTERIMAGE
          </p>
          <h1 style={{ fontSize: "20px", fontWeight: 400, color: "#f2ebdd" }}>
            应用遇到了严重错误
          </h1>
          <p style={{ fontSize: "14px", lineHeight: 1.7, color: "#9a9082" }}>
            本机保存的记忆与照片不受影响。请重试，或刷新页面重新开始。
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: "12px",
              minHeight: "44px",
              borderRadius: "9999px",
              border: "none",
              background: "#e6d5b0",
              color: "#1a1712",
              padding: "0 28px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            重试
          </button>
        </section>
      </body>
    </html>
  );
}