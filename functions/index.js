import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

initializeApp();

const ADMIN_EMAIL = "admin@futurecraftmanagement.com";

/**
 * Solo l'admin può chiamare questa funzione.
 * Crea un utente in Authentication (email/password) e il profilo in Firestore (nome attività, limite prenotazioni).
 * Non serve piano a pagamento: sul Blaze le invocazioni sono gratuite entro il limite mensile.
 */
export const createClientUser = onCall(
  { region: "europe-west1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Devi essere loggato.");
    }
    const adminEmail = (request.auth.token.email || "").toLowerCase();
    if (adminEmail !== ADMIN_EMAIL.toLowerCase()) {
      throw new HttpsError("permission-denied", "Solo l'admin può creare clienti.");
    }

    const { email, password, displayName, maxBookingsPerMonth } = request.data || {};
    if (!email || typeof email !== "string" || !email.trim()) {
      throw new HttpsError("invalid-argument", "Email obbligatoria.");
    }
    const emailNormalized = email.trim().toLowerCase();
    const passwordTrimmed = typeof password === "string" ? password.trim() : "";
    if (!passwordTrimmed || passwordTrimmed.length < 6) {
      throw new HttpsError("invalid-argument", "Password obbligatoria (min 6 caratteri).");
    }

    const auth = getAuth();
    const db = getFirestore();

    let userRecord;
    try {
      userRecord = await auth.createUser({
        email: emailNormalized,
        password: passwordTrimmed,
        displayName: displayName && String(displayName).trim() ? String(displayName).trim() : undefined,
      });
    } catch (err) {
      if (err.code === "auth/email-already-exists") {
        throw new HttpsError("already-exists", "Questa email è già registrata.");
      }
      if (err.code === "auth/invalid-email") {
        throw new HttpsError("invalid-argument", "Email non valida.");
      }
      if (err.code === "auth/weak-password") {
        throw new HttpsError("invalid-argument", "Password troppo debole (min 6 caratteri).");
      }
      throw new HttpsError("internal", err.message || "Errore creazione utente.");
    }

    const uid = userRecord.uid;
    const max = maxBookingsPerMonth != null && Number(maxBookingsPerMonth) >= 1
      ? Math.min(31, Math.max(1, Number(maxBookingsPerMonth)))
      : 2;

    await db.collection("userProfiles").doc(uid).set(
      {
        displayName: displayName && String(displayName).trim() ? String(displayName).trim() : "",
        email: emailNormalized,
        maxBookingsPerMonth: max,
      },
      { merge: true }
    );

    return {
      uid,
      email: emailNormalized,
      message: "Cliente creato. Comunica email e password al cliente per l'accesso.",
    };
  }
);
