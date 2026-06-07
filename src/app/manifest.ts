import { getAppConfig } from '@/lib/firestore-data';
import { type MetadataRoute } from 'next';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const config = await getAppConfig();
  const appName = config?.appName || 'CrediControl';
  const pwaLogo = config?.pwaLogoUrl || config?.logoUrl || '/icon-192x192.png';

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
        src: pwaLogo,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: pwaLogo,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
       {
        src: pwaLogo,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: pwaLogo,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      }
    ],
  };
}
