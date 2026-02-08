import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Booking, SlotId } from "@/types";
import { startOfMonth, endOfMonth, format } from "date-fns";

const BOOKINGS_COLLECTION = "bookings";

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

    const unsubscribe = onSnapshot(q, (snapshot) => {
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
    });

    return () => unsubscribe();
  }, [startDate, endDate]);

  return occupiedSlots;
}

// Conta le prenotazioni dell'utente nel mese corrente
export async function getUserMonthlyBookingCount(
  userId: string,
  month: Date
): Promise<number> {
  const start = format(startOfMonth(month), "yyyy-MM-dd");
  const end = format(endOfMonth(month), "yyyy-MM-dd");
  const q = query(
    collection(db, BOOKINGS_COLLECTION),
    where("userId", "==", userId),
    where("date", ">=", start),
    where("date", "<=", end)
  );
  const snapshot = await getDocs(q);
  return snapshot.size;
}

// Prenota uno slot
export async function bookSlot(
  userId: string,
  date: string,
  slotId: SlotId
): Promise<void> {
  await addDoc(collection(db, BOOKINGS_COLLECTION), {
    userId,
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

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((docSnap) => ({
        ...(docSnap.data() as Omit<Booking, "id">),
        id: docSnap.id,
        docId: docSnap.id,
      }));
      setBookings(list);
    });

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
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((docSnap) => ({
        ...(docSnap.data() as Omit<Booking, "id">),
        id: docSnap.id,
        docId: docSnap.id,
      }));
      setBookings(list);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  return bookings;
}
