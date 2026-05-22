import { useState } from "react";
import { api } from "../api";

const CONFETTI_COLORS = ["#f472b6", "#818cf8", "#34d399", "#fbbf24", "#22d3ee", "#f87171"];
const MESSAGES = [
  "Accès accordé, le cluster vous salue bien.",
  "Bravo. K3s est impressionné. (lui au moins)",
  "Authentifié·e ! Proxmox vous doit un café.",
  "Connexion réussie — et sans incident Jira. 🎉",
  "Le jury valide. Le 2FA aussi. Bonne journée.",
];

function Confetti() {
  const pieces = Array.from({ length: 18 }, (_, i) => i);
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {pieces.map((i) => (
        <span
          key={i}
          className="absolute w-2 h-2 rounded-sm animate-confetti"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 20}%`,
            backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${Math.random() * 0.8}s`,
            animationDuration: `${0.9 + Math.random() * 0.8}s`,
          }}
        />
      ))}
    </div>
  );
}

function EasterEgg({ onClose }) {
  const [msg] = useState(() => MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative text-center p-8 rounded-2xl bg-[#1e293b] border border-white/10 shadow-2xl max-w-xs w-full mx-4 animate-pop-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Confetti />

        {/* dancing emoji */}
        <div className="text-7xl mb-4 animate-wiggle select-none" role="img" aria-label="danse">
          🕺
        </div>

        <h2 className="text-xl font-bold text-white mb-1">
          Accès accordé !
        </h2>

        <p className="text-sm text-slate-400 mb-5 leading-relaxed">{msg}</p>

        {/* fake terminal line for extra nerd points */}
        <div className="mb-5 rounded-lg bg-black/40 border border-white/5 px-4 py-2 text-left font-mono text-xs text-green-400">
          <span className="text-slate-500">$ </span>
          kubectl auth can-i do everything<br />
          <span className="text-green-300">yes</span>
        </div>

        <button
          onClick={onClose}
          className="w-full h-10 rounded-xl bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500
            text-white text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition duration-200 cursor-pointer"
        >
          Je suis impressionné·e, merci
        </button>
      </div>
    </div>
  );
}

function EyeIcon({ open }) {
  return open ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      className="w-4 h-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      className="w-4 h-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin-slow" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function Login({ onRenew }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showEgg, setShowEgg] = useState(false);

  const handleLogin = async () => {
    if (!username || !password || !otp) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/authenticate", { username, password, otp });
      const msg = res.data.message === "authentication successful"
        ? "Authentification réussie"
        : res.data.message;
      setMessage(msg);
      setShowEgg(true);
    } catch (err) {
      const data = err.response?.data;
      if (data?.action === "renew") {
        onRenew(username);
        return;
      }
      const raw = data?.error || data?.message || "";
      setError(translateError(raw) || "Échec de l'authentification.");
    } finally {
      setLoading(false);
    }
  };

  const translateError = (raw) => {
    if (raw.includes("locked")) return "Compte temporairement verrouillé. Réessayez dans 5 minutes.";
    if (raw.includes("invalid credentials")) return "Identifiants ou code OTP incorrects.";
    if (raw.includes("user not found")) return "Utilisateur introuvable.";
    if (raw.includes("expired")) return "Identifiants expirés. Veuillez vous réinscrire.";
    if (raw.includes("setup_incomplete")) return "Configuration 2FA incomplète. Veuillez vous réinscrire.";
    return raw;
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) handleLogin();
  };

  return (
    <>
    {showEgg && <EasterEgg onClose={() => setShowEgg(false)} />}
    <div className="flex flex-col gap-5">
      {/* Username */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-username" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Nom d'utilisateur
        </label>
        <input
          id="login-username"
          type="text"
          autoComplete="username"
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="ex : alice"
          className="h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm
            focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition duration-200"
        />
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-password" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Mot de passe
        </label>
        <div className="relative">
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="••••••••••••"
            className="h-11 w-full pl-4 pr-11 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm
              focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition duration-200"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer p-1"
          >
            <EyeIcon open={showPassword} />
          </button>
        </div>
      </div>

      {/* OTP */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-otp" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Code OTP
        </label>
        <input
          id="login-otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          onKeyDown={handleKeyDown}
          placeholder="123456"
          className="h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm tracking-widest
            focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition duration-200"
        />
        <p className="text-xs text-slate-500">Code à 6 chiffres depuis votre application 2FA.</p>
      </div>

      {/* Submit */}
      <button
        onClick={handleLogin}
        disabled={loading}
        className="h-11 mt-1 rounded-xl bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 text-white text-sm font-semibold
          hover:opacity-90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed
          transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
      >
        {loading ? (
          <>
            <Spinner />
            <span>Vérification…</span>
          </>
        ) : (
          "Se connecter"
        )}
      </button>

      {/* Feedback */}
      {message && (
        <div role="status" className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-300 text-sm animate-fade-in">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
          </svg>
          {message}
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm animate-fade-in">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}
    </div>
    </>
  );
}
