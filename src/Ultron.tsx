import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Ultron() {
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") navigate("/");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="text-xs tracking-[0.3em] text-white/60">PEGASIS</div>
        <h1 className="mt-3 text-4xl font-semibold">
          Ultron Mode Route Placeholder
        </h1>
        <p className="mt-4 max-w-2xl text-white/70">
          This page will become the full cinematic Jarvis vs intruder sequence.
          Press <span className="text-white">Esc</span> to exit.
        </p>
      </div>
    </div>
  );
}