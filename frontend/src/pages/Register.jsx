import { useState, useEffect, useRef } from "react";
import { api } from "../api";

const PASSWORD_VISIBLE_SECONDS = 30;

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin-slow" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API not available
    }
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      aria-label="Copier le mot de passe"
      className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition duration-200 cursor-pointer"
    >
      {copied ? "Copié !" : "Copier"}
    </button>
  );
}

export default function Register({ prefillUsername }) {
  const [username, setUsername] = useState(prefillUsername || "");
  const [password, setPassword] = useState("");
  const [passwordQr, setPasswordQr] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (prefillUsername) setUsername(prefillUsername);
  }, [prefillUsername]);

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  const startCountdown = () => {
    setCountdown(PASSWORD_VISIBLE_SECONDS);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setPassword("");
          setPasswordQr("");
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRegister = async () => {
    if (!username) {
      setError("Veuillez saisir un nom d'utilisateur.");
      return;
    }
    if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) {
      setError("Le nom d'utilisateur doit contenir 3 à 32 caractères (lettres, chiffres, _ ou -).");
      return;
    }
    setError("");
    setPassword("");
    setPasswordQr("");
    setQrCode("");
    clearInterval(timerRef.current);
    setCountdown(null);
    setLoading(true);

    try {
      const passRes = await api.post("/generate-password", { username });
      setPassword(passRes.data.generated_password);
      setPasswordQr(passRes.data.qr_code_base64);

      const mfaRes = await api.post("/generate-2fa", { username });
      setQrCode(mfaRes.data.qr_code_base64);

      startCountdown();
    } catch (err) {
      const raw = err.response?.data?.error || err.response?.data?.message || "";
      setError(translateError(raw) || "Échec de l'inscription.");
    } finally {
      setLoading(false);
    }
  };

  const translateError = (raw) => {
    if (raw.includes("already exists")) return "Ce nom d'utilisateur est déjà pris.";
    if (raw.includes("3-32 characters")) return "Le nom d'utilisateur doit contenir 3 à 32 caractères (lettres, chiffres, _ ou -).";
    if (raw.includes("required")) return "Le nom d'utilisateur est obligatoire.";
    return raw;
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Username */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="reg-username" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Nom d'utilisateur
        </label>
        <input
          id="reg-username"
          type="text"
          autoComplete="username"
          autoFocus={!prefillUsername}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && handleRegister()}
          placeholder="ex : alice"
          className="h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm
            focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition duration-200"
        />
        <p className="text-xs text-slate-500">3–32 caractères : lettres, chiffres, tiret ou underscore.</p>
      </div>

      {/* Submit */}
      <button
        onClick={handleRegister}
        disabled={loading}
        className="h-11 rounded-xl bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white text-sm font-semibold
          hover:opacity-90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed
          transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
      >
        {loading ? (
          <>
            <Spinner />
            <span>Génération en cours…</span>
          </>
        ) : (
          "Générer mot de passe & 2FA"
        )}
      </button>

      {/* Error */}
      {error && (
        <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm animate-fade-in">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* Password result */}
      {password && (
        <div className="flex flex-col gap-2 p-4 rounded-xl bg-white/5 border border-white/10 animate-fade-in">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-pink-300 uppercase tracking-wider">Mot de passe généré</span>
            {countdown !== null && (
              <span className="text-xs text-slate-400 tabular-nums">
                Visible {countdown}s
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-mono text-white break-all leading-relaxed">{password}</code>
            <CopyButton text={password} />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Notez ce mot de passe — il disparaît dans {countdown ?? 0} secondes.
          </p>
        </div>
      )}

      {/* QR codes */}
      {(passwordQr || qrCode) && (
        <div className="flex flex-col gap-4 animate-fade-in">
          {passwordQr && (
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
              <p className="mb-3 text-xs font-semibold text-pink-300 uppercase tracking-wider">
                QR Code — Mot de passe
              </p>
              <img
                src={`data:image/png;base64,${passwordQr}`}
                alt="QR code contenant le mot de passe"
                className="mx-auto rounded-lg max-w-[180px] w-full"
              />
              <p className="mt-2 text-xs text-slate-500">Scannez pour copier le mot de passe.</p>
            </div>
          )}

          {qrCode && (
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
              <p className="mb-3 text-xs font-semibold text-cyan-300 uppercase tracking-wider">
                QR Code — Double authentification (2FA)
              </p>
              <img
                src={`data:image/png;base64,${qrCode}`}
                alt="QR code à scanner avec votre application 2FA"
                className="mx-auto rounded-lg max-w-[180px] w-full"
              />
              <p className="mt-2 text-xs text-slate-500">
                Scannez avec Google Authenticator, Authy ou FreeOTP.
              </p>
            </div>
          )}

          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
            <span>Scannez le QR code 2FA <strong>maintenant</strong> — il ne sera plus affiché. Vous aurez besoin de ce code à chaque connexion.</span>
          </div>
        </div>
      )}
    </div>
  );
}
