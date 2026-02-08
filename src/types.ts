export type SlotId = "morning" | "afternoon";

export interface Booking {
  id: string;
  date: string; // YYYY-MM-DD
  slotId: SlotId;
  userId: string;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  isAdmin: boolean;
}

// Profilo cliente (nome per admin)
export interface ClientProfile {
  uid: string;
  displayName: string;
  email?: string;
}
