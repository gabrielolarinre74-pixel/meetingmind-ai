/** @type {import('next').NextConfig} */
// Fully static export: MeetingMind runs in the browser, so ./out can be served by any static host.
// BASE_PATH is set by the deploy workflow (e.g. "/meetingmind-ai").
const basePath = process.env.BASE_PATH || '';

const nextConfig = {
  output: 'export',
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

module.exports = nextConfig;
