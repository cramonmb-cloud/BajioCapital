import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
                    <Image 
                      src={logoUrl} 
                      alt="Logo" 
                      width={200} 
                      height={200} 
                      className="h-48 w-48 object-contain rounded-2xl border shadow-lg bg-white p-2" 
                    />
                )}
                <h1 className="text-2xl font-bold tracking-tighter mt-2">{appName}</h1>
            </div>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
