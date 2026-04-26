
import RadialGradientButton from "@/components/pixel-perfect/radial-gradient-button";
import GithubStarButton from "@/components/GithubStarButton";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground">
      <h1 className="text-5xl font-bold italic text-white py-2">
        Astra Browser
      </h1>
      <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
        <RadialGradientButton>Coming soon</RadialGradientButton>
        <GithubStarButton />
      </div>
    </main>
  );
}
