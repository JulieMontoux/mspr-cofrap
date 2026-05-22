import { useState, useEffect } from "react";
import { api } from "../api";

export default function Register({ prefillUsername }) {
  const [username, setUsername] = useState(prefillUsername || "");
  const [password, setPassword] = useState("");
  const [passwordQr, setPasswordQr] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (prefillUsername) setUsername(prefillUsername);
  }, [prefillUsername]);

  const handleRegister = async () => {
    setError("");
    setPassword("");
    setPasswordQr("");
    setQrCode("");

    try {
      const passRes = await api.post("/generate-password", { username });
      setPassword(passRes.data.generated_password);
      setPasswordQr(passRes.data.qr_code_base64);

      const mfaRes = await api.post("/generate-2fa", { username });
      setQrCode(mfaRes.data.qr_code_base64);

      setTimeout(() => setPassword(""), 30000);
    } catch (err) {
      const backendMessage =
        err.response?.data?.error || err.response?.data?.message;
      setError(backendMessage || "Échec de l'inscription");
    }
  };

  return (
    <div className="relative flex flex-col gap-6">
      <div className="flex flex-col gap-6">
        <input
          className="p-3 rounded-xl bg-white/10 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
          placeholder="Nom d'utilisateur"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button
          onClick={handleRegister}
          className="py-3 rounded-full bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 text-black font-medium tracking-wide hover:scale-[1.02] active:scale-[0.98] transition"
        >
          Générer mot de passe & 2FA
        </button>
        {password && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-pink-400/20 via-purple-400/20 to-cyan-400/20 backdrop-blur border border-white/20 text-sm break-all">
            <strong>Mot de passe :</strong> {password}
          </div>
        )}
        {error && (
          <div className="p-3 rounded-xl bg-red-400/10 border border-red-400/30 text-red-300 text-sm text-center">
            {error}
          </div>
        )}
      </div>

      {/* QR codes */}
      {(passwordQr || qrCode) && (
        <div className="flex flex-col gap-4">
          {passwordQr && (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur text-center">
              <p className="mb-2 text-sm uppercase tracking-wide text-pink-300">
                QR Code — Mot de passe
              </p>
              <img
                src={`data:image/png;base64,${passwordQr}`}
                alt="Password QR Code"
                className="mx-auto rounded-lg"
              />
            </div>
          )}
          {qrCode && (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur text-center">
              <p className="mb-2 text-sm uppercase tracking-wide text-cyan-300">
                Scanner avec votre application 2FA
              </p>
              <img
                src={`data:image/png;base64,${qrCode}`}
                alt="2FA QR Code"
                className="mx-auto rounded-lg"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}