import { getAppConfig } from '@/lib/firestore-data';
import { Logo } from '@/components/logo';
import { LoginForm } from './login-form';
import { FloatingDollars } from './floating-dollars';

export default async function LoginPage() {
  const config = await getAppConfig();
  const logoUrl = config?.logoUrl;
  const appName = config?.appName || 'CrediControl';

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#F4F6F9] px-4 overflow-hidden select-none">
      
      {/* CSS Animation Keyframes for rotate gold border and glow breathing */}
      <style>{`
        @keyframes rotateGold {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes borderGoldGlow {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        .animate-rotate-gold {
          animation: rotateGold 8s linear infinite;
        }

        .animate-gold-glow {
          background-size: 200% 200%;
          animation: borderGoldGlow 6s ease infinite;
        }
      `}</style>

      {/* Ambient background glows for light color mesh */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-400/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-400/5 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] rounded-full bg-amber-400/[0.02] blur-[150px] pointer-events-none" />

      {/* Floating Dollar Signs Animation */}
      <FloatingDollars />

      {/* Main card wrapper with group for hover states and entry animation */}
      <div className="relative z-10 w-full max-w-[400px] group animate-in fade-in zoom-in-95 duration-500 ease-out">
        
        {/* Glowing aura shadow behind the card (pulsing gold glow) */}
        <div 
          className="absolute -inset-1.5 rounded-[34px] bg-gradient-to-r from-[#BF953F] via-[#FCF6BA] via-[#B38728] to-[#BF953F] opacity-15 blur-xl transition duration-1000 group-hover:opacity-25 group-hover:blur-2xl animate-gold-glow"
        />
        
        {/* 1.5px Outer Container with Rotating Gold Gradient Border */}
        <div 
          className="relative overflow-hidden rounded-[32px] p-[1.5px] transition-all duration-500 ease-out shadow-[0_25px_55px_-12px_rgba(15,23,42,0.12),_0_12px_24px_-8px_rgba(15,23,42,0.06),_0_0_80px_rgba(59,130,246,0.02)] group-hover:-translate-y-1.5 group-hover:shadow-[0_45px_80px_-15px_rgba(15,23,42,0.2),_0_20px_35px_-8px_rgba(15,23,42,0.1),_0_0_100px_rgba(59,130,246,0.05)]"
        >
          {/* Rotating Conic Gold Gradient Background for Circular Animation */}
          <div className="absolute inset-[-150%] bg-[conic-gradient(from_0deg,#BF953F,#FCF6BA,#B38728,#FBF5B7,#BF953F)] animate-rotate-gold pointer-events-none" />

          {/* Card Body: Glassmorphic White Container */}
          <div className="relative w-full bg-white/95 backdrop-blur-xl rounded-[30.5px] p-8 border border-white/50 z-10">
            
            {/* Header section: Logo & App Title */}
            <div className="flex flex-col items-center justify-center mb-6 gap-3.5 text-center">
              {logoUrl && (
                <div className="p-1 rounded-2xl bg-white border border-slate-100/80 shadow-[0_4px_12px_rgba(15,23,42,0.03)] transition duration-500 group-hover:scale-105">
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
              <div className="space-y-1.5">
                <h1 className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950">
                  {appName}
                </h1>
                <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-[0.25em]">
                  Portal de Acceso
                </p>
              </div>
            </div>

            {/* Inputs & submit button form */}
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
