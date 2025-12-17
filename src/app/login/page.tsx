
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import { getAppConfig } from '@/lib/firestore-data';
import Image from 'next/image';
import { LoginForm } from './login-form';


export default async function LoginPage() {
    const config = await getAppConfig();
    const logoUrl = config?.logoUrl;
    const appName = config?.appName || 'CrediControl';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
            <div className='flex flex-col items-center justify-center mb-4 gap-2'>
                {logoUrl && (
                    <Image src={logoUrl} alt="Logo" width={128} height={128} className="h-32 w-32 object-contain" />
                )}
                <h1 className="text-2xl font-bold tracking-tighter">{appName}</h1>
            </div>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
