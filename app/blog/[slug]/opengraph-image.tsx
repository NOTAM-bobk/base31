import { ImageResponse } from "next/og";
import { getBlogPost } from "@/lib/blogs";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage({ params }: { params: { slug: string } }) {
  const post = getBlogPost(params.slug);
  const title = post?.title || "base31.org blog";
  const lines = title.length > 42 ? [title.slice(0, 42), title.slice(42)] : [title];

  return new ImageResponse(
    (
      <div style={{ background: "#050505", color: "#ededed", display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between", padding: "76px", width: "100%" }}>
        <div style={{ color: "#46e891", display: "flex", fontSize: 28, fontWeight: 600 }}>base31.org / blog</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {lines.map((line) => (
            <div key={line} style={{ color: "#ffffff", display: "flex", fontSize: 62, fontWeight: 700, letterSpacing: "-0.055em", lineHeight: 1.08 }}>{line}</div>
          ))}
          {post?.description && <div style={{ color: "#a0a0a0", display: "flex", fontSize: 24, marginTop: 16 }}>{post.description.slice(0,  ninetyChars)}</div>}
        </div>
        <div style={{ color: "#777777", display: "flex", fontSize: 22 }}>{post?.date || "base31.org"}</div>
      </div>
    ),
    { ...size },
  );
}

const ninetyChars = 120;
