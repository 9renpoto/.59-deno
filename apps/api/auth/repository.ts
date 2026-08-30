import type { Ceremony, Passkey, Session, User } from "./types.ts";

export interface AuthRepository {
  findUserById(id: string): Promise<User | null>;
  findUserByUsername(username: string): Promise<User | null>;
  createUser(user: User): Promise<void>;
  listPasskeys(userId: string): Promise<Passkey[]>;
  findPasskey(id: string): Promise<Passkey | null>;
  createPasskey(passkey: Passkey): Promise<void>;
  updatePasskeyCounter(id: string, counter: number): Promise<void>;
  saveCeremony(ceremony: Ceremony): Promise<void>;
  consumeCeremony(id: string, kind: Ceremony["kind"]): Promise<Ceremony | null>;
  createSession(session: Session): Promise<void>;
  findSession(tokenHash: string): Promise<Session | null>;
  deleteSession(tokenHash: string): Promise<void>;
}

export class MemoryAuthRepository implements AuthRepository {
  readonly users = new Map<string, User>();
  readonly passkeys = new Map<string, Passkey>();
  readonly ceremonies = new Map<string, Ceremony>();
  readonly sessions = new Map<string, Session>();

  findUserById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }

  findUserByUsername(username: string): Promise<User | null> {
    return Promise.resolve(
      [...this.users.values()].find((user) => user.username === username) ??
        null,
    );
  }

  createUser(user: User): Promise<void> {
    if (
      [...this.users.values()].some((value) => value.username === user.username)
    ) {
      return Promise.reject(new Error("username already exists"));
    }
    this.users.set(user.id, user);
    return Promise.resolve();
  }

  listPasskeys(userId: string): Promise<Passkey[]> {
    return Promise.resolve(
      [...this.passkeys.values()].filter((passkey) =>
        passkey.userId === userId
      ),
    );
  }

  findPasskey(id: string): Promise<Passkey | null> {
    return Promise.resolve(this.passkeys.get(id) ?? null);
  }

  createPasskey(passkey: Passkey): Promise<void> {
    this.passkeys.set(passkey.id, passkey);
    return Promise.resolve();
  }

  updatePasskeyCounter(id: string, counter: number): Promise<void> {
    const passkey = this.passkeys.get(id);
    if (passkey) this.passkeys.set(id, { ...passkey, counter });
    return Promise.resolve();
  }

  saveCeremony(ceremony: Ceremony): Promise<void> {
    this.ceremonies.set(ceremony.id, ceremony);
    return Promise.resolve();
  }

  consumeCeremony(
    id: string,
    kind: Ceremony["kind"],
  ): Promise<Ceremony | null> {
    const ceremony = this.ceremonies.get(id);
    this.ceremonies.delete(id);
    if (
      !ceremony || ceremony.kind !== kind || ceremony.expiresAt <= Date.now()
    ) {
      return Promise.resolve(null);
    }
    return Promise.resolve(ceremony);
  }

  createSession(session: Session): Promise<void> {
    this.sessions.set(session.tokenHash, session);
    return Promise.resolve();
  }

  findSession(tokenHash: string): Promise<Session | null> {
    const session = this.sessions.get(tokenHash);
    if (!session || session.expiresAt <= Date.now()) {
      return Promise.resolve(null);
    }
    return Promise.resolve(session);
  }

  deleteSession(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
    return Promise.resolve();
  }
}
