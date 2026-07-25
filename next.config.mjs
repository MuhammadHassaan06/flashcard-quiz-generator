/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // pdf-parse ships a debug entrypoint that tries to read a local test file
    // at import time in some environments; externalizing avoids bundler issues.
    config.externals = [...(config.externals || []), { canvas: "canvas" }];
    return config;
  },
};

export default nextConfig;
