import { ImageResponse } from "next/og";

export const alt = "base31.org — cool sites for curious people";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#050505",
          color: "#ededed",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: "76px",
          width: "100%",
        }}
      >
        <div style={{ color: "#46e891", display: "flex", fontSize: 28, fontWeight: 600 }}>
          base31.org
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ color: "#ffffff", display: "flex", fontSize: 72, fontWeight: 700, letterSpacing: "-0.06em", lineHeight: 1.05 }}>
            Cool sites for
          </div>
          <div style={{ color: "#46e891", display: "flex", fontSize: 72, fontWeight: 700, letterSpacing: "-0.06em", lineHeight: 1.05 }}>
            curious people.
          </div>
          <div style={{ color: "#a0a0a0", display: "flex", fontSize: 26 }}>
            An independent directory of the interesting internet.
          </div>
        </div>
        <div style={{ color: "#777777", display: "flex", fontSize: 22 }}>
          websites · tools · experiments · projects
        </div>
      </div>
    ),
    { ...size },
  );
}
