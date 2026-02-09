import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isToday,
  parseISO,
  isBefore,
  startOfDay,
  addDays,
} from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/context/AuthContext";
import {
  useSlotAvailability,
  useUserBookings,
  useDisabledDates,
  useMyBookingLimit,
  bookSlot,
  cancelBooking,
  getUserMonthlyBookingCount,
  syncClientToUserProfile,
} from "@/hooks/useBookings";
import { SLOTS } from "@/config";
import type { SlotId } from "@/types";

export function CalendarPage() {
  const { user, logout, isAdmin } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [bookingCount, setBookingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const viewStart = addDays(monthStart, -7);
  const viewEnd = addDays(monthEnd, 14);

  const occupiedSlots = useSlotAvailability(viewStart, viewEnd);
  const userBookings = useUserBookings(user?.uid ?? null);
  const disabledDates = useDisabledDates();
  const myBookingLimit = useMyBookingLimit(user?.uid ?? null);

  // Calcolo slot occupati dall'utente corrente (per mostrare "Le tue prenotazioni")
  const myBookingsByDate = useMemo(() => {
    const map: Record<string, Record<SlotId, string>> = {};
    userBookings.forEach((b) => {
      if (!map[b.date]) map[b.date] = { morning: "", afternoon: "" };
      map[b.date][b.slotId] = b.docId;
    });
    return map;
  }, [userBookings]);

  const loadBookingCount = async () => {
    if (!user) return;
    const count = await getUserMonthlyBookingCount(user.uid, currentMonth);
    setBookingCount(count);
  };

  useEffect(() => {
    loadBookingCount();
  }, [user?.uid, currentMonth]);

  // Re-sync limite da Clienti (admin) a userProfile, così il limite aggiornato vale senza logout
  useEffect(() => {
    if (user?.uid && user?.email && !isAdmin) {
      syncClientToUserProfile(user.uid, user.email).catch(() => {});
    }
  }, [user?.uid, user?.email, isAdmin]);

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Prenotazioni future dell'utente (per la sezione "Le tue prenotazioni")
  const upcomingBookings = useMemo(() => {
    const today = format(startOfDay(new Date()), "yyyy-MM-dd");
    return userBookings
      .filter((b) => b.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [userBookings]);

  const handleBook = async (dateStr: string, slotId: SlotId) => {
    if (!user) return;
    if (disabledDates.includes(dateStr)) {
      setMessage({ type: "error", text: "Questo giorno non è prenotabile." });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const count = await getUserMonthlyBookingCount(
        user.uid,
        parseISO(dateStr)
      );
      if (count >= myBookingLimit) {
        setMessage({
          type: "error",
          text: `Hai già ${myBookingLimit} prenotazioni questo mese (il tuo limite).`,
        });
        setLoading(false);
        return;
      }
      await bookSlot(user.uid, user.email ?? null, dateStr, slotId);
      setMessage({ type: "success", text: "Prenotazione effettuata!" });
      loadBookingCount();
    } catch (err) {
      console.error("Errore prenotazione:", err);
      const msg = err instanceof Error ? err.message : "Impossibile prenotare. Riprova.";
      setMessage({
        type: "error",
        text: msg.includes("permission") || msg.includes("Permission") 
          ? "Permesso negato. Controlla che le regole Firestore siano deployate." 
          : msg,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (docId: string) => {
    setLoading(true);
    setMessage(null);
    try {
      await cancelBooking(docId);
      setMessage({ type: "success", text: "Prenotazione annullata." });
      loadBookingCount();
    } catch (err) {
      setMessage({
        type: "error",
        text: "Impossibile annullare. Riprova.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur safe-area-padding">
        <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg sm:text-xl font-bold text-white">FutureCraft</h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <span className="text-slate-400 text-xs sm:text-sm hidden md:inline truncate max-w-[120px] sm:max-w-none">
              {user?.email}
            </span>
            {bookingCount !== null && (
              <span className="text-slate-400 text-xs sm:text-sm whitespace-nowrap">
                {bookingCount}/{myBookingLimit} prenotazioni
              </span>
            )}
            <div className="flex items-center gap-2 sm:gap-3">
              {isAdmin && (
                <Link
                  to="/admin"
                  className="text-primary-400 hover:text-primary-300 text-sm font-medium py-2 px-3 -m-2 rounded-lg active:bg-slate-700/50 transition-colors"
                >
                  Admin
                </Link>
              )}
              <motion.button
                onClick={logout}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="text-slate-400 hover:text-white text-sm font-medium py-2 px-3 -m-2 rounded-lg active:bg-slate-700/50 transition-colors"
              >
                Esci
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8 pb-8 safe-area-padding">
        {/* Le tue prenotazioni */}
        {upcomingBookings.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-primary-500/10 border border-primary-500/30"
          >
            <h3 className="text-sm font-semibold text-primary-300 mb-3">Le tue prenotazioni</h3>
            <ul className="space-y-2">
              {upcomingBookings.map((b) => (
                <li
                  key={b.docId}
                  className="flex items-center justify-between gap-4 text-sm"
                >
                  <span className="text-white">
                    {format(parseISO(b.date), "EEEE d MMMM yyyy", { locale: it })} — {SLOTS.find((s) => s.id === b.slotId)?.label}
                  </span>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleCancel(b.docId)}
                    disabled={loading}
                    className="text-xs px-3 py-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 disabled:opacity-50"
                  >
                    Annulla
                  </motion.button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Month navigation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between mb-6 sm:mb-8 gap-2"
        >
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="py-3 px-4 sm:px-5 rounded-lg hover:bg-slate-700/50 active:bg-slate-700/70 text-slate-300 text-sm font-medium transition-colors touch-manipulation"
          >
            ← Indietro
          </button>
          <h2 className="text-base sm:text-xl font-semibold text-white capitalize text-center flex-1 min-w-0 truncate px-2">
            {format(currentMonth, "MMMM yyyy", { locale: it })}
          </h2>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="py-3 px-4 sm:px-5 rounded-lg hover:bg-slate-700/50 active:bg-slate-700/70 text-slate-300 text-sm font-medium transition-colors touch-manipulation"
          >
            Avanti →
          </button>
        </motion.div>

        {message && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`mb-6 px-4 py-4 rounded-xl border-2 ${
                message.type === "success"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                  : "bg-red-500/20 text-red-300 border-red-500/50"
              } border`}
            >
              <p className="font-medium">{message.text}</p>
            </motion.div>
          </AnimatePresence>
        )}

        {/* Calendar grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const isDayDisabled = disabledDates.includes(dateStr);
            const occupied = occupiedSlots[dateStr] ?? {
              morning: false,
              afternoon: false,
            };
            const myBooking = myBookingsByDate[dateStr];

            return (
              <motion.div
                key={dateStr}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-xl border border-slate-700/50 bg-slate-800/30 hover:border-slate-600 p-4 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`font-semibold ${
                      isToday(day) ? "text-primary-400" : "text-white"
                    }`}
                  >
                    {format(day, "d MMM", { locale: it })}
                  </span>
                  {isToday(day) && (
                    <span className="text-xs bg-primary-500/30 text-primary-300 px-2 py-0.5 rounded">
                      Oggi
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {SLOTS.map((slot) => {
                    const isOccupied = occupied[slot.id];
                    const isMine = myBooking?.[slot.id];
                    const isPast = isBefore(day, startOfDay(new Date()));

                    return (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between gap-2 min-h-[44px]"
                      >
                        <span className="text-xs sm:text-sm text-slate-400 flex-1 min-w-0">
                          {slot.label} ({slot.start}-{slot.end})
                        </span>
                        {isPast ? (
                          <span className="text-slate-500 text-xs shrink-0">
                            Passato
                          </span>
                        ) : isDayDisabled ? (
                          <span className="text-slate-500 text-xs shrink-0">
                            Non prenotabile
                          </span>
                        ) : isMine ? (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleCancel(isMine)}
                            disabled={loading}
                            className="text-xs px-4 py-2 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 active:bg-amber-500/40 transition-colors disabled:opacity-50 touch-manipulation shrink-0"
                          >
                            Annulla
                          </motion.button>
                        ) : isOccupied ? (
                          <span className="text-xs text-slate-500 shrink-0">
                            Non disponibile
                          </span>
                        ) : (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleBook(dateStr, slot.id)}
                            disabled={loading}
                            className="text-xs px-4 py-2 rounded-lg bg-primary-500/20 text-primary-300 hover:bg-primary-500/40 active:bg-primary-500/50 transition-colors disabled:opacity-50 touch-manipulation shrink-0"
                          >
                            Prenota
                          </motion.button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Legenda */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-8 p-4 rounded-xl bg-slate-800/30 border border-slate-700/50"
        >
          <h3 className="text-sm font-medium text-slate-300 mb-2">Legenda</h3>
          <ul className="text-sm text-slate-400 space-y-1">
            <li>• <span className="text-primary-300">Prenota</span> = Slot libero</li>
            <li>• <span className="text-slate-500">Non disponibile</span> = Già prenotato da qualcuno</li>
            <li>• <span className="text-slate-500">Non prenotabile</span> = Giorno disabilitato dall’admin</li>
            <li>• <span className="text-amber-300">Annulla</span> = Le tue prenotazioni (limite mensile impostato dal tuo referente)</li>
          </ul>
        </motion.div>
      </main>
    </div>
  );
}
