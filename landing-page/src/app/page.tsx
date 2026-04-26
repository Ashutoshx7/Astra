
import RadialGradientButton from "@/components/pixel-perfect/radial-gradient-button";
import GithubStarButton from "@/components/GithubStarButton";
import Keyboard from "@/components/Keyboard/Keyboard";

export default function Home() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center bg-background text-foreground overflow-hidden">
      {/* Starry Background */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-60">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(1px 1px at 20px 30px, #fff, rgba(0,0,0,0)),
              radial-gradient(1px 1px at 40px 70px, #fff, rgba(0,0,0,0)),
              radial-gradient(1px 1px at 50px 160px, #fff, rgba(0,0,0,0)),
              radial-gradient(1.5px 1.5px at 90px 40px, rgba(255,255,255,0.8), rgba(0,0,0,0)),
              radial-gradient(2px 2px at 130px 80px, rgba(255,255,255,0.6), rgba(0,0,0,0)),
              radial-gradient(1px 1px at 160px 120px, rgba(255,255,255,0.9), rgba(0,0,0,0))
            `,
            backgroundRepeat: 'repeat',
            backgroundSize: '200px 200px',
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000_100%)] opacity-80"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center w-full">
        <h1 className="text-5xl font-bold italic text-white py-2">
          Astra Browser
        </h1>

        <div className="flex flex-wrap items-center justify-center gap-4 my-6">
          <RadialGradientButton>Coming soon</RadialGradientButton>
          <GithubStarButton />
        </div>

        <div className="w-full max-w-2xl mt-12 flex flex-col gap-4">
          <div className="flex justify-between text-[11px] text-neutral-500 font-medium px-1 tracking-[0.2em] uppercase">
            <span>Development Progress</span>
            <span className="text-neutral-400">40%</span>
          </div>
          <div className="h-[2px] w-full bg-neutral-800 rounded-full relative">
            <div
              className="absolute top-0 left-0 h-full rounded-full"
              style={{
                width: '40%',
                background: 'linear-gradient(90deg, rgba(23,0,227,0) 0%, rgba(23,0,227,0.8) 50%, rgba(59,130,246,1) 100%)',
                boxShadow: '0 0 12px rgba(59,130,246,0.6), 0 0 24px rgba(23,0,227,0.4)'
              }}
            ></div>
          </div>
        </div>
      </div>
      
      <Keyboard />
    </main>
  );
}
