import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      console.error("Login error:", err);
      const firebaseErr = err as { code?: string; message?: string };
      const code = firebaseErr?.code || "";
      let msg = "Errore di accesso. Riprova.";
      if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") {
        msg = "Email o password non corretti.";
      } else if (code === "auth/too-many-requests") {
        msg = "Troppi tentativi. Riprova più tardi.";
      } else if (code === "auth/operation-not-allowed") {
        msg = "Login email/password non abilitato. Contatta l'amministratore.";
      } else if (code === "auth/invalid-email") {
        msg = "Email non valida.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-6 safe-area-padding">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-6 sm:p-8">
          <div className="text-center mb-8">
            <img src="/logo.png" alt="FutureCraft" className="h-16 sm:h-20 mx-auto mb-4 object-contain" />
            <h1 className="text-3xl font-bold text-white tracking-tight">
              FutureCraft
            </h1>
            <p className="text-slate-400 mt-2">
              Prenotazioni sessioni contenuti
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-red-500/20 border border-red-500/50 rounded-lg px-4 py-3 text-red-300 text-sm"
              >
                {error}
              </motion.div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg bg-slate-900/80 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-base"
                placeholder="tu@email.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg bg-slate-900/80 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-base"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              {loading ? "Accesso in corso..." : "Accedi"}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
