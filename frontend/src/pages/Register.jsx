import { useState } from "react";
import { api } from "../api";

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [error, setError] = useState("");

  const handleRegister = async () => {
    // Reset state
    setError("");
    setPassword("");
    setQrCode("");

    try {
      // Generate password
      const passRes = await api.post("/generate-password", { username });
      const generatedPassword = passRes.data.generated_password;
      setPassword(generatedPassword);

      // Generate 2FA
      const mfaRes = await api.post("/generate-2fa", { username });
      const base64Qr = mfaRes.data.qr_code_base64;
      setQrCode(base64Qr);

      // Auto-hide password after 30 seconds
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
    <div className="flex flex-col gap-4">
      <input
        className="p-2 rounded bg-slate-700"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      <button
        onClick={handleRegister}
        className="bg-blue-600 hover:bg-blue-700 p-2 rounded"
      >
        Generate Password
      </button>

      {password && (
        <div className="bg-slate-700 p-3 rounded text-sm break-all">
          <strong>Password:</strong> {password}
          <p className="text-xs mt-2 text-yellow-400">
            This password will disappear automatically.
          </p>
        </div>
      )}

      {qrCode && (
        <div className="bg-slate-800 p-4 rounded text-center">
          <p className="mb-3">
            Scan with Google Authenticator
          </p>
          <img
            src={`data:image/png;base64,${qrCode}`}
            alt="2FA QR Code"
            className="mx-auto"
          />
        </div>
      )}

      {error && (
        <div className="bg-red-500/20 text-red-400 p-2 rounded text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
