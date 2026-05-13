import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /**
   * Dev tunnels (ngrok, localtest.me, etc.) — lets the dev server accept the
   * browser’s `Host`/`Origin` when invoking Server Actions over HTTPS.
   * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
   */
  allowedDevOrigins: [
    '*.ngrok-free.app',
    '*.ngrok.io',
    '*.ngrok-free.dev',
    '*.ngrok.app',
  ],
  experimental: {
    serverActions: {
      allowedOrigins: [
        '*.ngrok-free.app',
        '*.ngrok.io',
        '*.ngrok-free.dev',
        '*.ngrok.app',
      ],
    },
  },
}

export default nextConfig
