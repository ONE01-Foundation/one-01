/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export → drops a plain `out/` folder we can host on Cloudflare Pages
  // (same as the Expo web export), on its own subdomain, with zero DNS changes.
  // one-web is entirely client-side (client components + Supabase in the
  // browser), so nothing here needs a server.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
