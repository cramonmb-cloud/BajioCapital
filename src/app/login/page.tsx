import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getAppConfig } from '@/lib/firestore-data';
import { Logo } from '@/components/logo';
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
                    <Logo 
                      logoUrl={logoUrl} 
                      logoFormat={config?.logoFormat} 
                      size="xl" 
                      customHeight={config?.logoHeightLogin}
                      customWidth={config?.logoWidthLogin}
                      className="flex items-center justify-center" 
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
