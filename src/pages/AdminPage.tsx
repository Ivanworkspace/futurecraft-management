import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
} from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/context/AuthContext";
import {
  useAllBookings,
  useUserProfilesMap,
  useDisabledDates,
  useDisabledSlots,
  useClients,
  addClient,
  updateClient,
  deleteClient,
  setDisabledDates,
  setDisabledSlots,
  updateBooking,
  adminDeleteBooking,
} from "@/hooks/useBookings";
import { createClientUserCallable } from "@/lib/firebase";
import { SLOTS } from "@/config";
import type { Booking, SlotId } from "@/types";

type Tab = "prenotazioni" | "giorni" | "clienti";
type PrenotazioniView = "list" | "calendar";

export function AdminPage() {
  const { logout, isAdmin } = useAuth();
  const bookings = useAllBookings(isAdmin);
  const profilesMap = useUserProfilesMap(isAdmin);
  const disabledDates = useDisabledDates();
  const disabledSlots = useDisabledSlots();
  const clients = useClients(isAdmin);

  const [activeTab, setActiveTab] = useState<Tab>("prenotazioni");
  const [editingBooking, setEditingBooking] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editSlot, setEditSlot] = useState<SlotId>("morning");
  const [newDisabledDate, setNewDisabledDate] = useState("");
  const [newDisabledScope, setNewDisabledScope] = useState<"day" | SlotId>("day");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form Clienti (unica sezione)
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formName, setFormName] = useState("");
  const [formMax, setFormMax] = useState<number>(2);
  const [formLoading, setFormLoading] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editClientName, setEditClientName] = useState("");
  const [editClientMax, setEditClientMax] = useState(2);
  const [prenotazioniView, setPrenotazioniView] = useState<PrenotazioniView>("list");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const clientsByEmail = useMemo(
    () => Object.fromEntries(clients.map((c) => [c.email, c.displayName || c.email])),
    [clients]
  );

  const sortedBookings = [...bookings].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const getSlotLabel = (slotId: string) =>
    SLOTS.find((s) => s.id === slotId)?.label ?? slotId;

  const getClientName = (b: Booking & { docId: string }) =>
    (b.userEmail && clientsByEmail[b.userEmail]) ??
    profilesMap[b.userId]?.displayName?.trim() ??
    profilesMap[b.userId]?.email ??
    b.userEmail ??
    `Cliente (${b.userId.slice(0, 8)}…)`;

  const bookingsByDate = useMemo(() => {
    const map: Record<string, Array<Booking & { docId: string }>> = {};
    bookings.forEach((b) => {
      if (!map[b.date]) map[b.date] = [];
      map[b.date].push(b);
    });
    return map;
  }, [bookings]);

  const calendarWeeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 });
    const weeks: Date[][] = [];
    let d = start;
    while (d <= end) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(d);
        d = addDays(d, 1);
      }
      weeks.push(week);
    }
    return weeks;
  }, [calendarMonth]);

  const selectedDayBookings = selectedDay ? (bookingsByDate[selectedDay] ?? []) : [];

  const handleUpdateBooking = async () => {
    if (!editingBooking || !editDate.trim()) return;
    setMessage(null);
    try {
      await updateBooking(editingBooking, { date: editDate, slotId: editSlot });
      setMessage({ type: "success", text: "Prenotazione aggiornata." });
      setEditingBooking(null);
    } catch (err) {
      setMessage({ type: "error", text: "Errore aggiornamento. Riprova." });
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    if (!confirm("Eliminare questa prenotazione?")) return;
    setMessage(null);
    try {
      await adminDeleteBooking(bookingId);
      setMessage({ type: "success", text: "Prenotazione eliminata." });
      setEditingBooking(null);
    } catch (err) {
      setMessage({ type: "error", text: "Errore eliminazione. Riprova." });
    }
  };

  const handleAddDisabled = async () => {
    if (!newDisabledDate.trim()) return;
    const dateStr = format(parseISO(newDisabledDate), "yyyy-MM-dd");
    setMessage(null);
    try {
      if (newDisabledScope === "day") {
        if (disabledDates.includes(dateStr)) {
          setMessage({ type: "error", text: "Questo giorno è già disabilitato." });
          return;
        }
        await setDisabledDates([...disabledDates, dateStr].sort());
        setMessage({ type: "success", text: "Giorno disabilitato." });
      } else {
        if (disabledSlots.some((s) => s.date === dateStr && s.slotId === newDisabledScope)) {
          setMessage({ type: "error", text: "Questo incontro è già disabilitato." });
          return;
        }
        await setDisabledSlots([...disabledSlots, { date: dateStr, slotId: newDisabledScope }]);
        setMessage({ type: "success", text: "Incontro disabilitato." });
      }
      setNewDisabledDate("");
    } catch (err) {
      setMessage({ type: "error", text: "Errore. Riprova." });
    }
  };

  const handleRemoveDisabledDate = async (dateStr: string) => {
    setMessage(null);
    try {
      await setDisabledDates(disabledDates.filter((d) => d !== dateStr));
      setMessage({ type: "success", text: "Giorno riattivato." });
    } catch (err) {
      setMessage({ type: "error", text: "Errore. Riprova." });
    }
  };

  const handleRemoveDisabledSlot = async (dateStr: string, slotId: string) => {
    setMessage(null);
    try {
      await setDisabledSlots(disabledSlots.filter((s) => !(s.date === dateStr && s.slotId === slotId)));
      setMessage({ type: "success", text: "Incontro riattivato." });
    } catch (err) {
      setMessage({ type: "error", text: "Errore. Riprova." });
    }
  };

  const handleAddClient = async () => {
    const email = formEmail.trim().toLowerCase();
    if (!email) {
      setMessage({ type: "error", text: "Email obbligatoria." });
      return;
    }
    if (!formPassword || formPassword.length < 6) {
      setMessage({ type: "error", text: "Password obbligatoria (min 6 caratteri)." });
      return;
    }
    setMessage(null);
    setFormLoading(true);
    const clientData = {
      email,
      displayName: formName.trim(),
      maxBookingsPerMonth: Math.max(1, Math.min(31, formMax)),
    };
    let authCreated = false;
    try {
      await createClientUserCallable({
        ...clientData,
        password: formPassword,
      });
      authCreated = true;
    } catch (err: unknown) {
      console.warn("Creazione account (Cloud Function):", err);
      const code = (err as { code?: string })?.code ?? "";
      const msg = String((err as { message?: string })?.message ?? "");
      if (code === "functions/already-exists" || msg.includes("già registrata")) {
        authCreated = true;
      } else if (code === "functions/invalid-argument") {
        setFormLoading(false);
        setMessage({ type: "error", text: msg || "Email o password non validi (password min 6 caratteri)." });
        return;
      } else if (code === "functions/unauthenticated" || code === "functions/permission-denied") {
        setFormLoading(false);
        setMessage({ type: "error", text: "Solo l'admin può creare clienti. Effettua il login come admin." });
        return;
      }
      // Per qualsiasi altro errore (rete, function non deployata, ecc.) continuiamo e salviamo solo su Firestore
    }
    try {
      await addClient(clientData);
      setFormEmail("");
      setFormPassword("");
      setFormName("");
      setFormMax(2);
      if (authCreated) {
        setMessage({ type: "success", text: "Cliente creato. Può accedere con email e password." });
      } else {
        setMessage({
          type: "success",
          text: "Cliente aggiunto all'elenco. Per permettere l'accesso, crea l'utente in Firebase Console (Authentication → Aggiungi utente) con questa email e la password inserita.",
        });
      }
    } catch (err) {
      console.error("Salvataggio cliente in Firestore:", err);
      setMessage({ type: "error", text: "Errore nel salvataggio dell'elenco. Riprova." });
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateClient = async () => {
    if (!editingClientId) return;
    setMessage(null);
    try {
      await updateClient(editingClientId, {
        displayName: editClientName.trim(),
        maxBookingsPerMonth: Math.max(1, Math.min(31, editClientMax)),
      });
      setMessage({ type: "success", text: "Cliente aggiornato." });
      setEditingClientId(null);
    } catch (err) {
      setMessage({ type: "error", text: "Errore. Riprova." });
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!confirm("Eliminare questo cliente dalla lista?")) return;
    setMessage(null);
    try {
      await deleteClient(clientId);
      setMessage({ type: "success", text: "Cliente rimosso." });
      setEditingClientId(null);
    } catch (err) {
      setMessage({ type: "error", text: "Errore. Riprova." });
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur safe-area-padding">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-4">
          <h1 className="text-lg sm:text-xl font-bold text-white">Pannello Admin</h1>
          <div className="flex items-center gap-3">
            <Link to="/" className="text-primary-400 hover:text-primary-300 text-sm font-medium py-2 px-3 -m-2 rounded-lg transition-colors">
              ← Calendario
            </Link>
            <motion.button onClick={logout} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="text-slate-400 hover:text-white text-sm font-medium py-2 px-3 -m-2 rounded-lg active:bg-slate-700/50 transition-colors touch-manipulation">
              Esci
            </motion.button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8 safe-area-padding">
        <div className="flex gap-2 mb-6 border-b border-slate-700 pb-2">
          {([{ id: "prenotazioni" as Tab, label: "Prenotazioni" }, { id: "giorni" as Tab, label: "Giorni disabilitati" }, { id: "clienti" as Tab, label: "Clienti" }] as const).map(({ id, label }) => (
            <button key={id} onClick={() => setActiveTab(id)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === id ? "bg-primary-500/30 text-primary-300" : "text-slate-400 hover:text-white"}`}>
              {label}
            </button>
          ))}
        </div>

        {message && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${message.type === "success" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50" : "bg-red-500/20 text-red-300 border border-red-500/50"}`}>
            {message.text}
          </div>
        )}

        {activeTab === "prenotazioni" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Prenotazioni</h2>
              <div className="flex rounded-lg bg-slate-800/80 border border-slate-700 p-0.5">
                <button
                  onClick={() => setPrenotazioniView("list")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${prenotazioniView === "list" ? "bg-primary-500/50 text-primary-200" : "text-slate-400 hover:text-white"}`}
                >
                  Lista
                </button>
                <button
                  onClick={() => setPrenotazioniView("calendar")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${prenotazioniView === "calendar" ? "bg-primary-500/50 text-primary-200" : "text-slate-400 hover:text-white"}`}
                >
                  Calendario
                </button>
              </div>
            </div>

            {prenotazioniView === "list" ? (
              <>
                {sortedBookings.length === 0 ? (
                  <p className="text-slate-500 py-6">Nessuna prenotazione.</p>
                ) : (
                  <div className="space-y-3">
                    {sortedBookings.map((b) => (
                      <div key={b.docId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                        <div className="min-w-0">
                          <p className="text-white font-medium">{getClientName(b)}</p>
                          <p className="text-slate-400 text-sm">{format(new Date(b.date), "d MMMM yyyy", { locale: it })} — {getSlotLabel(b.slotId)}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {editingBooking === b.docId ? (
                            <>
                              <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="px-2 py-1 rounded bg-slate-900 border border-slate-600 text-white text-sm" />
                              <select value={editSlot} onChange={(e) => setEditSlot(e.target.value as SlotId)} className="px-2 py-1 rounded bg-slate-900 border border-slate-600 text-white text-sm">
                                {SLOTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                              </select>
                              <button onClick={handleUpdateBooking} className="px-3 py-1 rounded bg-primary-500 text-white text-sm">Salva</button>
                              <button onClick={() => setEditingBooking(null)} className="px-3 py-1 rounded bg-slate-600 text-white text-sm">Annulla</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => { setEditingBooking(b.docId); setEditDate(b.date); setEditSlot(b.slotId); }} className="px-3 py-1 rounded bg-slate-600 hover:bg-slate-500 text-white text-sm">Modifica</button>
                              <button onClick={() => handleDeleteBooking(b.docId)} className="px-3 py-1 rounded bg-red-500/30 hover:bg-red-500/50 text-red-300 text-sm">Elimina</button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => setCalendarMonth((m) => subMonths(m, 1))} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50">‹</button>
                  <span className="text-white font-medium capitalize">{format(calendarMonth, "MMMM yyyy", { locale: it })}</span>
                  <button type="button" onClick={() => setCalendarMonth((m) => addMonths(m, 1))} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50">›</button>
                </div>
                <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-800/30">
                  <div className="grid grid-cols-7 text-center text-slate-400 text-xs border-b border-slate-700 py-2">
                    {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => (
                      <span key={d}>{d}</span>
                    ))}
                  </div>
                  {calendarWeeks.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7">
                      {week.map((day) => {
                        const dateStr = format(day, "yyyy-MM-dd");
                        const count = (bookingsByDate[dateStr]?.length ?? 0);
                        const isSelected = selectedDay === dateStr;
                        const isCurrentMonth = isSameMonth(day, calendarMonth);
                        return (
                          <button
                            key={dateStr}
                            type="button"
                            onClick={() => setSelectedDay(dateStr)}
                            className={`min-h-[44px] sm:min-h-[52px] p-1 text-sm border-b border-r border-slate-700/50 last:border-r-0 transition-colors ${!isCurrentMonth ? "text-slate-600" : "text-white hover:bg-slate-700/50"} ${isSelected ? "bg-primary-500/40 ring-1 ring-primary-400/60" : ""}`}
                          >
                            {format(day, "d")}
                            {count > 0 && <span className="block text-[10px] text-primary-400">{count}</span>}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {selectedDay && (
                  <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                    <h3 className="text-sm font-medium text-slate-300 mb-3">Appuntamenti del {format(parseISO(selectedDay), "d MMMM yyyy", { locale: it })}</h3>
                    {selectedDayBookings.length === 0 ? (
                      <p className="text-slate-500 text-sm">Nessun appuntamento in questa data.</p>
                    ) : (
                      <ul className="space-y-2">
                        {selectedDayBookings.map((b) => (
                          <li key={b.docId} className="flex items-center justify-between gap-2 py-2 border-b border-slate-700/50 last:border-0">
                            <span className="text-white font-medium">{getClientName(b)}</span>
                            <span className="text-slate-400 text-sm">{getSlotLabel(b.slotId)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "giorni" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <h2 className="text-lg font-semibold text-white">Giorni e incontri disabilitati</h2>
            <p className="text-slate-400 text-sm">Disabilita un intero giorno o solo un incontro (mattina o pomeriggio).</p>
            <div className="flex flex-wrap gap-2 items-center">
              <input type="date" value={newDisabledDate} onChange={(e) => setNewDisabledDate(e.target.value)} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white" />
              <select value={newDisabledScope} onChange={(e) => setNewDisabledScope(e.target.value as "day" | SlotId)} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white">
                <option value="day">Tutto il giorno</option>
                {SLOTS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <button onClick={handleAddDisabled} className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium">Aggiungi</button>
            </div>
            {disabledDates.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">Giorni interi disabilitati</h3>
                <ul className="space-y-2">
                  {disabledDates.map((d) => (
                    <li key={d} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                      <span className="text-white">{format(parseISO(d), "d MMMM yyyy", { locale: it })} — Tutto il giorno</span>
                      <button onClick={() => handleRemoveDisabledDate(d)} className="text-red-400 hover:text-red-300 text-sm">Riattiva</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {disabledSlots.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">Singoli incontri disabilitati</h3>
                <ul className="space-y-2">
                  {disabledSlots.map((s) => (
                    <li key={`${s.date}-${s.slotId}`} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                      <span className="text-white">{format(parseISO(s.date), "d MMMM yyyy", { locale: it })} — {SLOTS.find((x) => x.id === s.slotId)?.label ?? s.slotId}</span>
                      <button onClick={() => handleRemoveDisabledSlot(s.date, s.slotId)} className="text-red-400 hover:text-red-300 text-sm">Riattiva</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {disabledDates.length === 0 && disabledSlots.length === 0 && (
              <p className="text-slate-500 text-sm">Nessun giorno o incontro disabilitato.</p>
            )}
          </motion.div>
        )}

        {activeTab === "clienti" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <h2 className="text-lg font-semibold text-white">Clienti</h2>
            <p className="text-slate-400 text-sm">Aggiungi email, password (min 6 caratteri) e nome: l&apos;account viene creato subito e il cliente può accedere con queste credenziali.</p>

            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-3">
              <h3 className="text-sm font-medium text-slate-300">Aggiungi cliente</h3>
              <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="Email *" className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white" />
              <input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="Password (min 6 caratteri, per l'accesso del cliente)" className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white" />
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nome cliente / attività" className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white" />
              <div className="flex items-center gap-2">
                <label className="text-slate-400 text-sm">Max incontri al mese:</label>
                <input type="number" min={1} max={31} value={formMax} onChange={(e) => setFormMax(Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 2)))} className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-600 text-white text-sm" />
              </div>
              <button onClick={handleAddClient} disabled={formLoading} className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-medium">
                {formLoading ? "Salvataggio…" : "Salva cliente"}
              </button>
            </div>

            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-2">Lista clienti</h3>
              {clients.length === 0 ? (
                <p className="text-slate-500 text-sm">Nessun cliente. Aggiungine uno con il form sopra.</p>
              ) : (
                <ul className="space-y-3">
                  {clients.map((c) => (
                    <li key={c.id} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                      {editingClientId === c.id ? (
                        <div className="space-y-2">
                          <input type="text" value={editClientName} onChange={(e) => setEditClientName(e.target.value)} placeholder="Nome" className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-sm">Max incontri/mese:</span>
                            <input type="number" min={1} max={31} value={editClientMax} onChange={(e) => setEditClientMax(Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 2)))} className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-600 text-white text-sm" />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={handleUpdateClient} className="px-3 py-1 rounded bg-primary-500 text-white text-sm">Salva</button>
                            <button onClick={() => setEditingClientId(null)} className="px-3 py-1 rounded bg-slate-600 text-white text-sm">Annulla</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div>
                            <p className="text-white font-medium">{c.displayName || "—"}</p>
                            <p className="text-slate-500 text-sm">{c.email}</p>
                            <p className="text-slate-400 text-xs">Max {c.maxBookingsPerMonth} incontri/mese</p>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => { setEditingClientId(c.id); setEditClientName(c.displayName); setEditClientMax(c.maxBookingsPerMonth); }} className="px-3 py-1 rounded bg-slate-600 hover:bg-slate-500 text-white text-sm">Modifica</button>
                            <button onClick={() => handleDeleteClient(c.id)} className="px-3 py-1 rounded bg-red-500/30 hover:bg-red-500/50 text-red-300 text-sm">Elimina</button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
