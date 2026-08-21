import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allows hot-reloading and dev resources when testing from mobile devices on your local network
  allowedDevOrigins: ["10.6.179.32", "10.*", "192.168.*", "localhost:*"],
};

export default nextConfig;
