import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development", // Keeps dev mode fast, enables PWA on production build
});

const nextConfig: NextConfig = {
  // Any existing Next.js config options go here
};

export default withPWA(nextConfig);