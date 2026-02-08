// Email dell'account admin - crea questo utente nella console Firebase Authentication
// Vai su: https://console.firebase.google.com → Authentication → Add user
export const ADMIN_EMAIL = "admin@futurecraftmanagement.com";

// Slot disponibili ogni giorno (in formato 24h)
export const SLOTS = [
  { id: "morning", label: "Mattina", start: 9, end: 13 },
  { id: "afternoon", label: "Pomeriggio", start: 15, end: 18 },
] as const;

// Limite prenotazioni per cliente al mese
export const MAX_BOOKINGS_PER_MONTH = 2;
