import { motion } from "framer-motion";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/context/AuthContext";
import { useAllBookings } from "@/hooks/useBookings";
import { SLOTS } from "@/config";

export function AdminPage() {
  const { logout, isAdmin } = useAuth();
  const bookings = useAllBookings(isAdmin);

  const getSlotLabel = (slotId: string) => {
    return SLOTS.find((s) => s.id === slotId)?.label ?? slotId;
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur safe-area-padding">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          <h1 className="text-lg sm:text-xl font-bold text-white">Pannello Admin</h1>
          <motion.button
            onClick={logout}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="text-slate-400 hover:text-white text-sm font-medium py-2 px-3 -m-2 rounded-lg active:bg-slate-700/50 transition-colors touch-manipulation"
          >
            Esci
          </motion.button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8 safe-area-padding">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6"
        >
          <h2 className="text-lg font-semibold text-white mb-4">
            Tutte le prenotazioni
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Le prenotazioni sono mostrate in forma anonima (solo ID utente Firebase). 
            I clienti vedono solo "Non disponibile" senza sapere chi ha prenotato.
          </p>

          {bookings.length === 0 ? (
            <p className="text-slate-500 text-center py-8">
              Nessuna prenotazione al momento.
            </p>
          ) : (
            <div className="space-y-3">
              {bookings.map((b, i) => (
                <motion.div
                  key={b.docId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 rounded-xl bg-slate-900/50 border border-slate-700/50"
                >
                  <div className="min-w-0">
                    <span className="text-white font-medium">
                      {format(new Date(b.date), "d MMMM yyyy", { locale: it })}
                    </span>
                    <span className="text-slate-400 ml-2">
                      — {getSlotLabel(b.slotId)}
                    </span>
                  </div>
                  <span className="text-slate-500 text-xs font-mono shrink-0">
                    User: {b.userId.slice(0, 8)}...
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
