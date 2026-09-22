import { ImageResponse } from "next/og";

export const alt = "base31.org blog — notes on the interesting internet";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ background: "#050505", color: "#ededed", display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between", padding: "76px", width: "100%" }}>
        <div style={{ color: "#46e891", display: "flex", fontSize: 28, fontWeight: 600 }}>base31.org / blog</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ color: "#ffffff", display: "flex", fontSize: 68, fontWeight: 700, letterSpacing: "-0.06em" }}>Notes on the</div>
          <div style={{ color: "#46e891", display: "flex", fontSize: 68, fontWeight: 700, letterSpacing: "-0.06em" }}>interesting internet.</div>
        </div>
        <div style={{ color: "#777777", display: "flex", fontSize: 22 }}>guides · roundups · the independent web</div>
      </div>
    ),
    { ...size },
  );
}
