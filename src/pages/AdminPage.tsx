import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/context/AuthContext";
import {
  useAllBookings,
  useUserProfilesMap,
  useDisabledDates,
  saveUserProfile,
  setDisabledDates,
  updateBooking,
  adminDeleteBooking,
} from "@/hooks/useBookings";
import { createClientUserCallable } from "@/lib/firebase";
import { SLOTS } from "@/config";
import type { SlotId } from "@/types";

type Tab = "prenotazioni" | "giorni" | "clienti" | "crea";

export function AdminPage() {
  const { logout, isAdmin } = useAuth();
  const bookings = useAllBookings(isAdmin);
  const profilesMap = useUserProfilesMap(isAdmin);
  const disabledDates = useDisabledDates();

  const [activeTab, setActiveTab] = useState<Tab>("prenotazioni");
  const [editingBooking, setEditingBooking] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editSlot, setEditSlot] = useState<SlotId>("morning");
  const [newDisabledDate, setNewDisabledDate] = useState("");
  const [editingProfileUid, setEditingProfileUid] = useState<string | null>(null);
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileMaxBookings, setProfileMaxBookings] = useState<number>(2);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form Crea cliente
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPassword, setNewClientPassword] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientMaxBookings, setNewClientMaxBookings] = useState<number>(2);
  const [createLoading, setCreateLoading] = useState(false);
  const [addUidValue, setAddUidValue] = useState("");
  const [addUidLoading, setAddUidLoading] = useState(false);

  const sortedBookings = [...bookings].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const getSlotLabel = (slotId: string) =>
    SLOTS.find((s) => s.id === slotId)?.label ?? slotId;

  const getClientName = (uid: string) =>
    profilesMap[uid]?.displayName?.trim() || profilesMap[uid]?.email || `Cliente (${uid.slice(0, 8)}…)`;

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

  const handleAddDisabledDate = async () => {
    if (!newDisabledDate.trim()) return;
    const dateStr = format(parseISO(newDisabledDate), "yyyy-MM-dd");
    if (disabledDates.includes(dateStr)) {
      setMessage({ type: "error", text: "Data già disabilitata." });
      return;
    }
    setMessage(null);
    try {
      await setDisabledDates([...disabledDates, dateStr].sort());
      setMessage({ type: "success", text: "Giorno disabilitato." });
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

  const handleAddProfileByUid = async () => {
    const uid = addUidValue.trim();
    if (!uid || uid.length < 8) {
      setMessage({ type: "error", text: "Inserisci un UID valido (lo trovi in Firebase Console → Authentication → Users)." });
      return;
    }
    setMessage(null);
    setAddUidLoading(true);
    try {
      await saveUserProfile(uid, { displayName: "", maxBookingsPerMonth: 2 });
      setMessage({ type: "success", text: "Profilo creato. Modifica nome e limite qui sotto." });
      setAddUidValue("");
      setEditingProfileUid(uid);
      setProfileDisplayName("");
      setProfileEmail("");
      setProfileMaxBookings(2);
    } catch (err) {
      setMessage({ type: "error", text: "Errore. Controlla l'UID e le regole Firestore." });
    } finally {
      setAddUidLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editingProfileUid || !profileDisplayName.trim()) return;
    const max = Math.max(1, Math.min(31, profileMaxBookings));
    setMessage(null);
    try {
      await saveUserProfile(editingProfileUid, {
        displayName: profileDisplayName.trim(),
        email: profileEmail.trim() || undefined,
        maxBookingsPerMonth: max,
      });
      setMessage({ type: "success", text: "Profilo salvato." });
      setEditingProfileUid(null);
    } catch (err) {
      setMessage({ type: "error", text: "Errore salvataggio. Riprova." });
    }
  };

  const uniqueUids = Array.from(
    new Set([...bookings.map((b) => b.userId), ...Object.keys(profilesMap)])
  ).sort();

  const handleCreateClient = async () => {
    const email = newClientEmail.trim();
    const password = newClientPassword;
    if (!email || !password) {
      setMessage({ type: "error", text: "Email e password obbligatorie." });
      return;
    }
    if (password.length < 6) {
      setMessage({ type: "error", text: "La password deve avere almeno 6 caratteri." });
      return;
    }
    setMessage(null);
    setCreateLoading(true);
    try {
      const result = await createClientUserCallable({
        email,
        password,
        displayName: newClientName.trim() || undefined,
        maxBookingsPerMonth: Math.max(1, Math.min(31, newClientMaxBookings)),
      });
      const data = result.data;
      setMessage({ type: "success", text: data?.message || "Cliente creato. Comunica email e password al cliente." });
      setNewClientEmail("");
      setNewClientPassword("");
      setNewClientName("");
      setNewClientMaxBookings(2);
    } catch (err: unknown) {
      console.error("Errore creazione cliente:", err);
      const e = err as { code?: string; message?: string; details?: unknown };
      const code = e?.code ?? "";
      const msg = e?.message ?? "";
      let text = msg || "Errore creazione cliente. Riprova.";
      if (code === "functions/already-exists" || msg.includes("già registrata")) text = "Questa email è già registrata.";
      else if (code === "functions/invalid-argument") text = msg || "Dati non validi (email e password min 6 caratteri).";
      else if (code === "functions/permission-denied") text = "Solo l'admin può creare clienti.";
      else if (code === "functions/unauthenticated") text = "Devi essere loggato.";
      else if (code === "functions/not-found" || msg.includes("NOT_FOUND") || msg.includes("404")) text = "Funzione non trovata. Hai fatto il deploy? (firebase deploy --only functions) e il progetto è su piano Blaze?";
      else if (code === "functions/internal" || msg.includes("CORS") || msg.includes("Failed to fetch") || msg.includes("Load failed") || msg.includes("NetworkError")) text = "Da localhost è normale (CORS). Crea l'utente da Firebase Console → Authentication → Add user, poi in tab Clienti incolla l'UID e clicca Aggiungi profilo. Oppure usa l'app deployata (Vercel).";
      else if (msg) text = msg;
      setMessage({ type: "error", text });
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur safe-area-padding">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-4">
          <h1 className="text-lg sm:text-xl font-bold text-white">Pannello Admin</h1>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-primary-400 hover:text-primary-300 text-sm font-medium py-2 px-3 -m-2 rounded-lg transition-colors"
            >
              ← Calendario
            </Link>
            <motion.button
              onClick={logout}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="text-slate-400 hover:text-white text-sm font-medium py-2 px-3 -m-2 rounded-lg active:bg-slate-700/50 transition-colors touch-manipulation"
            >
              Esci
            </motion.button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8 safe-area-padding">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-700 pb-2">
          {(
            [
              { id: "prenotazioni" as Tab, label: "Prenotazioni" },
              { id: "giorni" as Tab, label: "Giorni disabilitati" },
              { id: "clienti" as Tab, label: "Clienti" },
              { id: "crea" as Tab, label: "Crea cliente" },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === id
                  ? "bg-primary-500/30 text-primary-300"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {message && (
          <div
            className={`mb-4 px-4 py-3 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50"
                : "bg-red-500/20 text-red-300 border border-red-500/50"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Tab: Prenotazioni */}
        {activeTab === "prenotazioni" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-white">Tutte le prenotazioni</h2>
            {sortedBookings.length === 0 ? (
              <p className="text-slate-500 py-6">Nessuna prenotazione.</p>
            ) : (
              <div className="space-y-3">
                {sortedBookings.map((b) => (
                  <div
                    key={b.docId}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50"
                  >
                    <div className="min-w-0">
                      <p className="text-white font-medium">
                        {getClientName(b.userId)}
                      </p>
                      <p className="text-slate-400 text-sm">
                        {format(new Date(b.date), "d MMMM yyyy", { locale: it })} — {getSlotLabel(b.slotId)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {editingBooking === b.docId ? (
                        <>
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="px-2 py-1 rounded bg-slate-900 border border-slate-600 text-white text-sm"
                          />
                          <select
                            value={editSlot}
                            onChange={(e) => setEditSlot(e.target.value as SlotId)}
                            className="px-2 py-1 rounded bg-slate-900 border border-slate-600 text-white text-sm"
                          >
                            {SLOTS.map((s) => (
                              <option key={s.id} value={s.id}>{s.label}</option>
                            ))}
                          </select>
                          <button
                            onClick={handleUpdateBooking}
                            className="px-3 py-1 rounded bg-primary-500 text-white text-sm"
                          >
                            Salva
                          </button>
                          <button
                            onClick={() => setEditingBooking(null)}
                            className="px-3 py-1 rounded bg-slate-600 text-white text-sm"
                          >
                            Annulla
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingBooking(b.docId);
                              setEditDate(b.date);
                              setEditSlot(b.slotId);
                            }}
                            className="px-3 py-1 rounded bg-slate-600 hover:bg-slate-500 text-white text-sm"
                          >
                            Modifica
                          </button>
                          <button
                            onClick={() => handleDeleteBooking(b.docId)}
                            className="px-3 py-1 rounded bg-red-500/30 hover:bg-red-500/50 text-red-300 text-sm"
                          >
                            Elimina
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Tab: Giorni disabilitati */}
        {activeTab === "giorni" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-white">Giorni senza prenotazioni</h2>
            <p className="text-slate-400 text-sm">
              In questi giorni i clienti non potranno prenotare.
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="date"
                value={newDisabledDate}
                onChange={(e) => setNewDisabledDate(e.target.value)}
                className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white"
              />
              <button
                onClick={handleAddDisabledDate}
                className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium"
              >
                Aggiungi giorno
              </button>
            </div>
            {disabledDates.length > 0 ? (
              <ul className="space-y-2">
                {disabledDates.map((d) => (
                  <li
                    key={d}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50"
                  >
                    <span className="text-white">
                      {format(parseISO(d), "d MMMM yyyy", { locale: it })}
                    </span>
                    <button
                      onClick={() => handleRemoveDisabledDate(d)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Riattiva
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500 text-sm">Nessun giorno disabilitato.</p>
            )}
          </motion.div>
        )}

        {/* Tab: Nomi clienti */}
        {activeTab === "clienti" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-white">Clienti</h2>
            <p className="text-slate-400 text-sm">
              Nome, email e quante prenotazioni al mese può fare ogni cliente (1–31). Se non imposti il limite, vale 2.
            </p>
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 mb-4">
              <p className="text-slate-300 text-sm mb-2">Hai creato un utente da Firebase Console?</p>
              <p className="text-slate-500 text-xs mb-2">Copia l&apos;UID da Authentication → Users → clicca sull&apos;utente → UID.</p>
              <div className="flex gap-2 flex-wrap">
                <input
                  type="text"
                  value={addUidValue}
                  onChange={(e) => setAddUidValue(e.target.value)}
                  placeholder="Incolla UID qui"
                  className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm font-mono"
                />
                <button
                  onClick={handleAddProfileByUid}
                  disabled={addUidLoading}
                  className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white text-sm"
                >
                  {addUidLoading ? "…" : "Aggiungi profilo"}
                </button>
              </div>
            </div>
            {uniqueUids.length === 0 ? (
              <p className="text-slate-500 py-6">Nessun cliente ancora. Crea utenti da Console (link sopra in Crea cliente) e aggiungi il profilo con l&apos;UID qui sopra.</p>
            ) : (
              <div className="space-y-3">
                {uniqueUids.map((uid) => (
                  <div
                    key={uid}
                    className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50"
                  >
                    {editingProfileUid === uid ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Nome cliente"
                          value={profileDisplayName}
                          onChange={(e) => setProfileDisplayName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white"
                        />
                        <input
                          type="email"
                          placeholder="Email (opzionale)"
                          value={profileEmail}
                          onChange={(e) => setProfileEmail(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white"
                        />
                        <div>
                          <label className="block text-slate-400 text-sm mb-1">
                            Max prenotazioni al mese (1–31)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={31}
                            value={profileMaxBookings}
                            onChange={(e) => setProfileMaxBookings(Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 1)))}
                            className="w-24 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveProfile}
                            className="px-4 py-2 rounded-lg bg-primary-500 text-white text-sm"
                          >
                            Salva
                          </button>
                          <button
                            onClick={() => setEditingProfileUid(null)}
                            className="px-4 py-2 rounded-lg bg-slate-600 text-white text-sm"
                          >
                            Annulla
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <p className="text-white font-medium">
                            {profilesMap[uid]?.displayName || "— Nessun nome —"}
                          </p>
                          <p className="text-slate-500 text-xs font-mono">{uid.slice(0, 12)}…</p>
                          <p className="text-slate-400 text-xs mt-1">
                            Max {profilesMap[uid]?.maxBookingsPerMonth ?? 2} prenotazioni/mese
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setEditingProfileUid(uid);
                            setProfileDisplayName(profilesMap[uid]?.displayName || "");
                            setProfileEmail(profilesMap[uid]?.email || "");
                            setProfileMaxBookings(profilesMap[uid]?.maxBookingsPerMonth ?? 2);
                          }}
                          className="px-3 py-1 rounded-lg bg-slate-600 hover:bg-slate-500 text-white text-sm"
                        >
                          Modifica
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Tab: Crea cliente */}
        {activeTab === "crea" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-white">Crea nuovo cliente</h2>
            <p className="text-slate-400 text-sm">
              Inserisci email, password e nome attività. Il cliente potrà fare login con queste credenziali.
            </p>
            <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
              <strong>Da localhost</strong> &quot;Crea cliente&quot; spesso dà errore CORS (normale). Puoi:
              <br />• Creare l&apos;utente da{" "}
              <a
                href="https://console.firebase.google.com/project/futurecraftmanagament/authentication/users"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                Firebase Console → Authentication → Add user
              </a>
              , poi nella tab <strong>Clienti</strong> incollare l&apos;<strong>UID</strong> e cliccare &quot;Aggiungi profilo&quot; per nome e limite.
              <br />• Oppure usare &quot;Crea cliente&quot; dall&apos;<strong>app deployata</strong> (es. su Vercel), dove di solito funziona.
            </div>
            <div className="max-w-md space-y-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <div>
                <label className="block text-slate-400 text-sm mb-1">Email *</label>
                <input
                  type="email"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  placeholder="cliente@email.com"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">Password * (min 6 caratteri)</label>
                <input
                  type="password"
                  value={newClientPassword}
                  onChange={(e) => setNewClientPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">Nome attività / Cliente</label>
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="es. Azienda Rossi"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">Max prenotazioni al mese (1–31)</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={newClientMaxBookings}
                  onChange={(e) => setNewClientMaxBookings(Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 2)))}
                  className="w-24 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white"
                />
              </div>
              <button
                onClick={handleCreateClient}
                disabled={createLoading}
                className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-medium"
              >
                {createLoading ? "Creazione…" : "Crea cliente"}
              </button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
