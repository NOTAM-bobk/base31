/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "s0.wp.com", pathname: "/mshots/**" },
      { protocol: "https", hostname: "image.thum.io", pathname: "/get/**" },
    ],
  },
};

module.exports = nextConfig;
