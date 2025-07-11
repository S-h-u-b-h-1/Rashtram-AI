/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.launchuicomponents.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
