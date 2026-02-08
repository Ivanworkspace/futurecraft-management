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
  bookSlot,
  cancelBooking,
  getUserMonthlyBookingCount,
} from "@/hooks/useBookings";
import { SLOTS, MAX_BOOKINGS_PER_MONTH } from "@/config";
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

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const handleBook = async (dateStr: string, slotId: SlotId) => {
    if (!user) return;
    setLoading(true);
    setMessage(null);
    try {
      const count = await getUserMonthlyBookingCount(
        user.uid,
        parseISO(dateStr)
      );
      if (count >= MAX_BOOKINGS_PER_MONTH) {
        setMessage({
          type: "error",
          text: `Hai già ${MAX_BOOKINGS_PER_MONTH} prenotazioni questo mese.`,
        });
        setLoading(false);
        return;
      }
      await bookSlot(user.uid, dateStr, slotId);
      setMessage({ type: "success", text: "Prenotazione effettuata!" });
      loadBookingCount();
    } catch (err) {
      setMessage({
        type: "error",
        text: "Impossibile prenotare. Riprova.",
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
                {bookingCount}/{MAX_BOOKINGS_PER_MONTH} prenotazioni
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
              className={`mb-6 px-4 py-3 rounded-lg ${
                message.type === "success"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50"
                  : "bg-red-500/20 text-red-300 border border-red-500/50"
              }`}
            >
              {message.text}
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
            <li>• <span className="text-primary-300">Prenota</span> = Slot libero, puoi prenotare</li>
            <li>• <span className="text-slate-500">Non disponibile</span> = Qualcuno ha già prenotato (in modo anonimo)</li>
            <li>• <span className="text-amber-300">Annulla</span> = Le tue prenotazioni (max 2 al mese)</li>
          </ul>
        </motion.div>
      </main>
    </div>
  );
}
