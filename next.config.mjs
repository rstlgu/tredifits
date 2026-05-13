/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/render-spin": ["./node_modules/ffmpeg-static/ffmpeg"]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "60mb"
    }
  }
};

export default nextConfig;
