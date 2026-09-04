export type CeremonyKind = "registration" | "authentication";

export interface User {
  id: string;
  username: string;
  displayName: string;
  createdAt: number;
}

export interface Passkey {
  id: string;
  userId: string;
  publicKey: Uint8Array;
  counter: number;
  deviceType: string;
  backedUp: boolean;
  transports: string[];
  createdAt: number;
}

export interface Ceremony {
  id: string;
  kind: CeremonyKind;
  challenge: string;
  userId: string | null;
  username: string | null;
  displayName: string | null;
  expiresAt: number;
}

export interface Session {
  tokenHash: string;
  userId: string;
  expiresAt: number;
}
