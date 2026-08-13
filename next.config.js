/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["bullmq", "ioredis"],
  },
};

module.exports = nextConfig;