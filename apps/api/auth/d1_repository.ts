import type { AuthRepository } from "./repository.ts";
import type { Ceremony, Passkey, Session, User } from "./types.ts";

export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface D1Database {
  prepare(query: string): D1Statement;
}

interface PasskeyRow {
  id: string;
  user_id: string;
  public_key: ArrayBuffer;
  counter: number;
  device_type: string;
  backed_up: number;
  transports: string;
  created_at: number;
}

export class D1AuthRepository implements AuthRepository {
  constructor(private readonly db: D1Database) {}

  findUserById(id: string): Promise<User | null> {
    return this.db.prepare(
      "SELECT id, username, display_name AS displayName, created_at AS createdAt FROM users WHERE id = ?1",
    ).bind(id).first<User>();
  }

  findUserByUsername(username: string): Promise<User | null> {
    return this.db.prepare(
      "SELECT id, username, display_name AS displayName, created_at AS createdAt FROM users WHERE username = ?1",
    ).bind(username).first<User>();
  }

  async createUser(user: User): Promise<void> {
    await this.db.prepare(
      "INSERT INTO users (id, username, display_name, created_at) VALUES (?1, ?2, ?3, ?4)",
    ).bind(user.id, user.username, user.displayName, user.createdAt).run();
  }

  async listPasskeys(userId: string): Promise<Passkey[]> {
    const rows = await this.db.prepare(
      "SELECT id, user_id, public_key, counter, device_type, backed_up, transports, created_at FROM passkeys WHERE user_id = ?1",
    ).bind(userId).all<PasskeyRow>();
    return rows.results.map(toPasskey);
  }

  async findPasskey(id: string): Promise<Passkey | null> {
    const row = await this.db.prepare(
      "SELECT id, user_id, public_key, counter, device_type, backed_up, transports, created_at FROM passkeys WHERE id = ?1",
    ).bind(id).first<PasskeyRow>();
    return row ? toPasskey(row) : null;
  }

  async createPasskey(passkey: Passkey): Promise<void> {
    await this.db.prepare(
      "INSERT INTO passkeys (id, user_id, public_key, counter, device_type, backed_up, transports, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
    ).bind(
      passkey.id,
      passkey.userId,
      new Uint8Array(passkey.publicKey).buffer,
      passkey.counter,
      passkey.deviceType,
      passkey.backedUp ? 1 : 0,
      JSON.stringify(passkey.transports),
      passkey.createdAt,
    ).run();
  }

  async updatePasskeyCounter(id: string, counter: number): Promise<void> {
    await this.db.prepare("UPDATE passkeys SET counter = ?2 WHERE id = ?1")
      .bind(id, counter).run();
  }

  async saveCeremony(ceremony: Ceremony): Promise<void> {
    await this.db.prepare(
      "INSERT INTO ceremonies (id, kind, challenge, user_id, username, display_name, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    ).bind(
      ceremony.id,
      ceremony.kind,
      ceremony.challenge,
      ceremony.userId,
      ceremony.username,
      ceremony.displayName,
      ceremony.expiresAt,
    ).run();
  }

  async consumeCeremony(
    id: string,
    kind: Ceremony["kind"],
  ): Promise<Ceremony | null> {
    const row = await this.db.prepare(
      "DELETE FROM ceremonies WHERE id = ?1 AND kind = ?2 RETURNING id, kind, challenge, user_id AS userId, username, display_name AS displayName, expires_at AS expiresAt",
    ).bind(id, kind).first<Ceremony>();
    return row && row.expiresAt > Date.now() ? row : null;
  }

  async createSession(session: Session): Promise<void> {
    await this.db.prepare(
      "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?1, ?2, ?3)",
    ).bind(session.tokenHash, session.userId, session.expiresAt).run();
  }

  findSession(tokenHash: string): Promise<Session | null> {
    return this.db.prepare(
      "SELECT token_hash AS tokenHash, user_id AS userId, expires_at AS expiresAt FROM sessions WHERE token_hash = ?1 AND expires_at > ?2",
    ).bind(tokenHash, Date.now()).first<Session>();
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.db.prepare("DELETE FROM sessions WHERE token_hash = ?1")
      .bind(tokenHash).run();
  }
}

function toPasskey(row: PasskeyRow): Passkey {
  return {
    id: row.id,
    userId: row.user_id,
    publicKey: new Uint8Array(row.public_key),
    counter: row.counter,
    deviceType: row.device_type,
    backedUp: row.backed_up === 1,
    transports: JSON.parse(row.transports),
    createdAt: row.created_at,
  };
}
