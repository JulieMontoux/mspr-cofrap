import { useState } from "react";
import Login from "./pages/Login";
import Register from "./pages/Register";

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      className="w-8 h-8 text-purple-400" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  );
}

export default function App() {
  const [page, setPage] = useState("login");
  const [renewUsername, setRenewUsername] = useState("");

  const handleRenew = (username) => {
    setRenewUsername(username);
    setPage("register");
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#020617] text-white px-4 py-8 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute -top-40 -left-40 w-80 h-80 md:w-96 md:h-96 bg-pink-500 opacity-10 blur-3xl rounded-full pointer-events-none" aria-hidden="true" />
      <div className="absolute -bottom-40 -right-40 w-80 h-80 md:w-96 md:h-96 bg-cyan-500 opacity-10 blur-3xl rounded-full pointer-events-none" aria-hidden="true" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600 opacity-5 blur-3xl rounded-full pointer-events-none" aria-hidden="true" />

      <div className="relative w-full max-w-sm sm:max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-white/10 mb-4">
            <ShieldIcon />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            <span className="text-white">COFRAP</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400 font-medium tracking-wide uppercase">
            Plateforme d'authentification sécurisée
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/40 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setPage("login")}
              aria-selected={page === "login"}
              role="tab"
              className={`flex-1 py-4 text-sm font-semibold tracking-wide transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-inset ${
                page === "login"
                  ? "text-white border-b-2 border-purple-400 bg-white/5"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              Connexion
            </button>
            <button
              onClick={() => setPage("register")}
              aria-selected={page === "register"}
              role="tab"
              className={`flex-1 py-4 text-sm font-semibold tracking-wide transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-inset ${
                page === "register"
                  ? "text-white border-b-2 border-purple-400 bg-white/5"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              Inscription
            </button>
          </div>

          {/* Page content */}
          <div className="p-6 sm:p-8">
            <div className="animate-fade-in" key={page}>
              {page === "login" && <Login onRenew={handleRenew} />}
              {page === "register" && <Register prefillUsername={renewUsername} />}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          MSPR TPRE921 — EPSI · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
