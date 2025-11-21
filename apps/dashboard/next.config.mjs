/** @type {import('next').NextConfig} */
const nextConfig = {
  // React Compiler disabled for MVP
  // experimental: {
  //   reactCompiler: true
  // }
  env: {
    // Avoid duplicating the Supabase URL: if the public one isn't set, reuse SUPABASE_URL
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  }
};

export default nextConfig;


