import { useState } from "react";
import { api } from "../api";

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [error, setError] = useState("");

  const handleRegister = async () => {
    setError("");
    setPassword("");
    setQrCode("");

    try {
      const passRes = await api.post("/generate-password", { username });
      const generatedPassword = passRes.data.generated_password;
      setPassword(generatedPassword);

      const mfaRes = await api.post("/generate-2fa", { username });
      const base64Qr = mfaRes.data.qr_code_base64;
      setQrCode(base64Qr);

      // Auto hide password after 30 seconds
      setTimeout(() => {
        setPassword("");
      }, 30000);

    } catch (err) {
      const backendMessage =
        err.response?.data?.error ||
        err.response?.data?.message;

      setError(backendMessage || "Registration failed");
    }
  };

return (
  <div className="relative flex flex-col gap-6">

    {/* Form column */}
    <div className="flex flex-col gap-6 max-w-sm">

      <input
        className="p-3 rounded-xl bg-white/10 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      <button
        onClick={handleRegister}
        className="py-3 rounded-full bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 text-black font-medium tracking-wide hover:scale-[1.02] active:scale-[0.98] transition"
      >
        Generate Password
      </button>

      {password && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-pink-400/20 via-purple-400/20 to-cyan-400/20 backdrop-blur border border-white/20 text-sm break-all">
          <strong>Password:</strong> {password}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-red-400/10 border border-red-400/30 text-red-300 text-sm text-center">
          {error}
        </div>
      )}

    </div>

    {/* QR floating panel (desktop only) */}
    {qrCode && (
      <div className="hidden md:block absolute top-0 translate-x-full ml-[8rem]">
        <div className="p-6 w-64 rounded-2xl bg-white/5 border border-white/10 backdrop-blur text-center shadow-xl animate-fade-in">
          <p className="mb-4 text-sm uppercase tracking-wide text-cyan-300">
            Scan with Authenticator
          </p>
          <img
            src={`data:image/png;base64,${qrCode}`}
            alt="2FA QR Code"
            className="rounded-lg"
          />
        </div>
      </div>
    )}

    {/* Mobile QR */}
    {qrCode && (
      <div className="md:hidden p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur text-center animate-fade-in">
        <p className="mb-4 text-sm uppercase tracking-wide text-cyan-300">
          Scan with Authenticator
        </p>
        <img
          src={`data:image/png;base64,${qrCode}`}
          alt="2FA QR Code"
          className="mx-auto rounded-lg"
        />
      </div>
    )}

  </div>
);



}
