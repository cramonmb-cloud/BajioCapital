import { getAppConfig } from '@/lib/firestore-data';
import { type MetadataRoute } from 'next';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const config = await getAppConfig();
  const appName = config?.appName || 'CrediControl';
  const logoUrl = config?.logoUrl || '/icon-192x192.png'; // Fallback icon

  return {
    name: appName,
    short_name: appName,
    description: `Gestión de préstamos para ${appName}`,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      {
        src: logoUrl,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: logoUrl,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
       {
        src: logoUrl,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: logoUrl,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      }
    ],
  };
}
