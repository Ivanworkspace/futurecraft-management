import { useState, useEffect, useRef } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MAX_BOOKINGS_PER_MONTH } from "@/config";
import type { Booking, SlotId } from "@/types";
import { startOfMonth, endOfMonth, format } from "date-fns";

const BOOKINGS_COLLECTION = "bookings";
const USER_PROFILES_COLLECTION = "userProfiles";
const CLIENTS_COLLECTION = "clients";

/** Id documento Firestore per email (niente @ o .) */
function clientIdFromEmail(email: string): string {
  return email.trim().toLowerCase().replace(/@/g, "_at_").replace(/\./g, "_");
}

// Restituisce se uno slot è occupato (anonimo - non mostra chi)
export function useSlotAvailability(startDate: Date, endDate: Date) {
  const [occupiedSlots, setOccupiedSlots] = useState<
    Record<string, Record<SlotId, boolean>>
  >({});

  useEffect(() => {
    const q = query(
      collection(db, BOOKINGS_COLLECTION),
      where("date", ">=", format(startDate, "yyyy-MM-dd")),
      where("date", "<=", format(endDate, "yyyy-MM-dd"))
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const occupied: Record<string, Record<SlotId, boolean>> = {};
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const date = data.date as string;
          const slotId = data.slotId as SlotId;
          if (!occupied[date]) {
            occupied[date] = { morning: false, afternoon: false };
          }
          occupied[date][slotId] = true;
        });
        setOccupiedSlots(occupied);
      },
      (err) => {
        console.warn("useSlotAvailability:", err?.message || err);
        setOccupiedSlots({});
      }
    );

    return () => unsubscribe();
  }, [startDate, endDate]);

  return occupiedSlots;
}

// Conta le prenotazioni dell'utente nel mese corrente (senza indice composito)
export async function getUserMonthlyBookingCount(
  userId: string,
  month: Date
): Promise<number> {
  const start = format(startOfMonth(month), "yyyy-MM-dd");
  const end = format(endOfMonth(month), "yyyy-MM-dd");
  const q = query(
    collection(db, BOOKINGS_COLLECTION),
    where("userId", "==", userId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.filter(
    (d) => (d.data().date as string) >= start && (d.data().date as string) <= end
  ).length;
}

// Prenota uno slot (userEmail serve all'admin per mostrare il nome)
export async function bookSlot(
  userId: string,
  userEmail: string | null,
  date: string,
  slotId: SlotId
): Promise<void> {
  await addDoc(collection(db, BOOKINGS_COLLECTION), {
    userId,
    userEmail: userEmail || null,
    date,
    slotId,
    createdAt: Timestamp.now(),
  });
}

// Cancella una prenotazione (l'ownership è verificata dalle Firestore rules)
export async function cancelBooking(bookingId: string): Promise<void> {
  const bookingDoc = doc(db, BOOKINGS_COLLECTION, bookingId);
  await deleteDoc(bookingDoc);
}

// Admin: aggiorna una prenotazione (data e/o slot)
export async function updateBooking(
  bookingId: string,
  data: { date: string; slotId: SlotId }
): Promise<void> {
  const bookingRef = doc(db, BOOKINGS_COLLECTION, bookingId);
  await updateDoc(bookingRef, { date: data.date, slotId: data.slotId });
}

// Admin: elimina una prenotazione (qualsiasi)
export async function adminDeleteBooking(bookingId: string): Promise<void> {
  await deleteDoc(doc(db, BOOKINGS_COLLECTION, bookingId));
}

// Hook per le prenotazioni dell'utente
export function useUserBookings(userId: string | null) {
  const [bookings, setBookings] = useState<Array<Booking & { docId: string }>>(
    []
  );

  useEffect(() => {
    if (!userId) {
      setBookings([]);
      return;
    }
    const q = query(
      collection(db, BOOKINGS_COLLECTION),
      where("userId", "==", userId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          ...(docSnap.data() as Omit<Booking, "id">),
          id: docSnap.id,
          docId: docSnap.id,
        }));
        setBookings(list);
      },
      (err) => {
        console.warn("useUserBookings:", err?.message || err);
        setBookings([]);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return bookings;
}

// Hook per admin: tutte le prenotazioni (con dettagli anonimi)
export function useAllBookings(isAdmin: boolean) {
  const [bookings, setBookings] = useState<Array<Booking & { docId: string }>>(
    []
  );

  useEffect(() => {
    if (!isAdmin) {
      setBookings([]);
      return;
    }
    const q = collection(db, BOOKINGS_COLLECTION);
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          ...(docSnap.data() as Omit<Booking, "id">),
          id: docSnap.id,
          docId: docSnap.id,
        }));
        setBookings(list);
      },
      (err) => {
        console.warn("useAllBookings:", err?.message || err);
        setBookings([]);
      }
    );

    return () => unsubscribe();
  }, [isAdmin]);

  return bookings;
}

// --- User profiles (nomi clienti per admin, limite prenotazioni) ---
export type ClientProfileData = {
  displayName: string;
  email?: string;
  maxBookingsPerMonth?: number;
};

export function useUserProfilesMap(isAdmin: boolean) {
  const [profiles, setProfiles] = useState<Record<string, ClientProfileData>>({});

  useEffect(() => {
    if (!isAdmin) {
      setProfiles({});
      return;
    }
    const q = collection(db, USER_PROFILES_COLLECTION);
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const map: Record<string, ClientProfileData> = {};
        snapshot.docs.forEach((d) => {
          const data = d.data();
          map[d.id] = {
            displayName: data.displayName || "",
            email: data.email,
            maxBookingsPerMonth: data.maxBookingsPerMonth != null ? Number(data.maxBookingsPerMonth) : undefined,
          };
        });
        setProfiles(map);
      },
      (err) => {
        console.warn("useUserProfilesMap:", err?.message || err);
        setProfiles({});
      }
    );
    return () => unsubscribe();
  }, [isAdmin]);

  return profiles;
}

/** Limite prenotazioni al mese per l'utente corrente (per clienti nel calendario) */
export function useMyBookingLimit(userId: string | null) {
  const [limit, setLimit] = useState<number>(MAX_BOOKINGS_PER_MONTH);
  const hasReceivedValue = useRef(false);

  useEffect(() => {
    hasReceivedValue.current = false;
    if (!userId) {
      setLimit(MAX_BOOKINGS_PER_MONTH);
      return;
    }
    const ref = doc(db, USER_PROFILES_COLLECTION, userId);
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        const n = snapshot.data()?.maxBookingsPerMonth;
        const value = n != null && n >= 1 ? Number(n) : MAX_BOOKINGS_PER_MONTH;
        hasReceivedValue.current = true;
        setLimit(value);
      },
      () => {
        if (!hasReceivedValue.current) setLimit(MAX_BOOKINGS_PER_MONTH);
      }
    );
    return () => unsubscribe();
  }, [userId]);

  return limit;
}

export async function saveUserProfile(
  uid: string,
  data: { displayName: string; email?: string; maxBookingsPerMonth?: number }
): Promise<void> {
  const payload: Record<string, unknown> = {
    displayName: data.displayName,
    email: data.email ?? null,
  };
  if (data.maxBookingsPerMonth != null && data.maxBookingsPerMonth >= 1) {
    payload.maxBookingsPerMonth = data.maxBookingsPerMonth;
  }
  await setDoc(doc(db, USER_PROFILES_COLLECTION, uid), payload, { merge: true });
}

// --- Giorni / slot disabilitati ---
export function useDisabledDates() {
  const [dates, setDates] = useState<string[]>([]);

  useEffect(() => {
    const ref = doc(db, "config", "calendar");
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        const list = (snapshot.data()?.disabledDates as string[] | undefined) || [];
        setDates(Array.isArray(list) ? list : []);
      },
      (err) => {
        console.warn("useDisabledDates:", err?.message || err);
        setDates([]);
      }
    );
    return () => unsubscribe();
  }, []);

  return dates;
}

export type DisabledSlot = { date: string; slotId: string };

export function useDisabledSlots() {
  const [slots, setSlots] = useState<DisabledSlot[]>([]);

  useEffect(() => {
    const ref = doc(db, "config", "calendar");
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        const list = (snapshot.data()?.disabledSlots as DisabledSlot[] | undefined) || [];
        setSlots(Array.isArray(list) ? list : []);
      },
      (err) => {
        console.warn("useDisabledSlots:", err?.message || err);
        setSlots([]);
      }
    );
    return () => unsubscribe();
  }, []);

  return slots;
}

export async function setDisabledDates(dates: string[]): Promise<void> {
  await setDoc(doc(db, "config", "calendar"), { disabledDates: dates }, { merge: true });
}

export async function setDisabledSlots(slots: DisabledSlot[]): Promise<void> {
  await setDoc(doc(db, "config", "calendar"), { disabledSlots: slots }, { merge: true });
}

// --- Clienti (solo Firestore: email, nome, max incontri) ---
export interface ClientRecord {
  id: string;
  email: string;
  displayName: string;
  maxBookingsPerMonth: number;
}

export function useClients(isAdmin: boolean) {
  const [clients, setClients] = useState<ClientRecord[]>([]);

  useEffect(() => {
    if (!isAdmin) {
      setClients([]);
      return;
    }
    const q = collection(db, CLIENTS_COLLECTION);
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            email: (data.email as string) || "",
            displayName: (data.displayName as string) || "",
            maxBookingsPerMonth: data.maxBookingsPerMonth != null ? Number(data.maxBookingsPerMonth) : 2,
          };
        });
        setClients(list);
      },
      (err) => {
        console.warn("useClients:", err?.message || err);
        setClients([]);
      }
    );
    return () => unsubscribe();
  }, [isAdmin]);

  return clients;
}

export async function addClient(data: {
  email: string;
  displayName: string;
  maxBookingsPerMonth: number;
}): Promise<void> {
  const id = clientIdFromEmail(data.email);
  if (!id) throw new Error("Email non valida");
  await setDoc(doc(db, CLIENTS_COLLECTION, id), {
    email: data.email.trim().toLowerCase(),
    displayName: data.displayName.trim(),
    maxBookingsPerMonth: Math.max(1, Math.min(31, data.maxBookingsPerMonth)),
  }, { merge: true });
}

export async function updateClient(
  clientId: string,
  data: { displayName: string; maxBookingsPerMonth: number }
): Promise<void> {
  await updateDoc(doc(db, CLIENTS_COLLECTION, clientId), {
    displayName: data.displayName.trim(),
    maxBookingsPerMonth: Math.max(1, Math.min(31, data.maxBookingsPerMonth)),
  });
}

export async function deleteClient(clientId: string): Promise<void> {
  await deleteDoc(doc(db, CLIENTS_COLLECTION, clientId));
}

/** Al login: se esiste un client con questa email, copia sempre in userProfiles (così il limite aggiornato dall'admin vale).
 * Usa getDocFromServer per evitare cache: una lettura da cache potrebbe avere maxBookingsPerMonth vecchio (es. 2) e sovrascrivere il valore corretto (es. 4). */
export async function syncClientToUserProfile(uid: string, email: string | null): Promise<void> {
  if (!email || !email.trim()) return;
  const emailNorm = email.trim().toLowerCase();
  const id = clientIdFromEmail(emailNorm);
  const clientRef = doc(db, CLIENTS_COLLECTION, id);
  let clientSnap;
  try {
    clientSnap = await getDocFromServer(clientRef);
  } catch {
    clientSnap = await getDoc(clientRef);
  }
  if (!clientSnap.exists()) return;
  const d = clientSnap.data();
  const max = d.maxBookingsPerMonth != null && Number(d.maxBookingsPerMonth) >= 1
    ? Math.min(31, Math.max(1, Number(d.maxBookingsPerMonth)))
    : 2;
  await setDoc(doc(db, USER_PROFILES_COLLECTION, uid), {
    displayName: (d.displayName != null && d.displayName !== "") ? String(d.displayName).trim() : "",
    email: (d.email != null && d.email !== "") ? String(d.email).trim().toLowerCase() : emailNorm,
    maxBookingsPerMonth: max,
  }, { merge: true });
}
