import { getAppConfig } from '@/lib/firestore-data';
import { Logo } from '@/components/logo';
import { LoginForm } from './login-form';
import { FloatingDollars } from './floating-dollars';

export default async function LoginPage() {
  const config = await getAppConfig();
  const logoUrl = config?.logoUrl;
  const appName = config?.appName || 'CrediControl';
  const coverImageUrl = config?.loginCoverUrl;
  const loginTitle = config?.loginTitle || 'Control Integral de tu Negocio';
  const loginSubtitle = config?.loginSubtitle || 'Administra expedientes de personal, supervisa la cobranza en tiempo real, organiza zonas, planes de crédito y asegura el control operativo de tu negocio.';

  return (
    <div className="flex min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 select-none overflow-hidden">
      
      {/* Columna Izquierda: Imagen de Portada configurable (Visible solo en desktop) */}
      <div className="hidden md:flex md:w-[50%] lg:w-[60%] relative overflow-hidden bg-slate-950">
        {/* Imagen de Fondo de Portada */}
        {coverImageUrl ? (
          <img 
            src={coverImageUrl} 
            alt="Portada de Login" 
            className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none animate-in fade-in duration-1000 ease-out"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950" />
        )}
        
        {/* Máscara oscura para contraste */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/25 to-black/35 z-10" />

        {/* Luces decorativas */}
        <div className="absolute top-1/4 left-1/4 w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[100px] pointer-events-none z-10" />
        <div className="absolute bottom-1/4 right-1/4 w-[40%] h-[40%] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none z-10" />

        {/* Textos y Marca */}
        <div className="relative z-20 flex flex-col justify-between h-full w-full p-12 lg:p-16 text-white animate-in fade-in slide-in-from-left-6 duration-700">
          {/* Top Header */}
          <div className="flex items-center gap-3">
            {logoUrl && (
              <div className="p-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lg">
                <Logo 
                  logoUrl={logoUrl} 
                  logoFormat={config?.logoFormat} 
                  size="md" 
                  className="invert brightness-0 scale-95" 
                />
              </div>
            )}
            <span className="text-lg font-black tracking-tight">{appName}</span>
          </div>

          {/* Bottom Info */}
          <div className="space-y-4 max-w-lg">
            <h2 className="text-4xl lg:text-5xl font-black leading-tight tracking-tight drop-shadow-md">
              {loginTitle}
            </h2>
            <p className="text-sm lg:text-base text-white/80 leading-relaxed font-medium">
              {loginSubtitle}
            </p>
            <div className="h-1.5 w-16 bg-primary rounded-full mt-2" />
          </div>
        </div>
      </div>

      {/* Columna Derecha: Formulario de Login */}
      <div className="w-full md:w-[50%] lg:w-[40%] flex flex-col justify-between bg-[#F8FAFC] dark:bg-slate-950 p-8 md:p-12 lg:p-16 relative">
        {/* Iluminación de fondo */}
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />

        {/* Animación de Dólares flotando */}
        <FloatingDollars />

        {/* Card Contenedor */}
        <div className="flex-1 flex flex-col justify-center max-w-[380px] w-full mx-auto relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Logo y Encabezado */}
          <div className="flex flex-col items-center mb-8 gap-4 text-center">
            {logoUrl && (
              <div className="p-1 rounded-2xl bg-white border border-slate-100/80 shadow-[0_4px_16px_rgba(15,23,42,0.04)] transition duration-500 hover:scale-105">
                <Logo 
                  logoUrl={logoUrl} 
                  logoFormat={config?.logoFormat} 
                  size="xl" 
                  customHeight={config?.logoHeightLogin}
                  customWidth={config?.logoWidthLogin}
                  className="flex items-center justify-center scale-95" 
                />
              </div>
            )}
            <div className="space-y-1">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                {appName}
              </h1>
              <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-[0.25em]">
                Ingresa al Sistema
              </p>
            </div>
          </div>

          {/* Formulario */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/40 rounded-3xl p-6 md:p-8 shadow-[0_20px_50px_rgba(15,23,42,0.04)]">
            <LoginForm />
          </div>
        </div>

        {/* Copyright */}
        <div className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider relative z-10 mt-8">
          © {new Date().getFullYear()} {appName} · Todos los derechos reservados
        </div>
      </div>
      
    </div>
  );
}
