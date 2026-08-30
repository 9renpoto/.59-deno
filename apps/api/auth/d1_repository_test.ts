import {
  assert,
  assertEquals,
  assertInstanceOf,
  assertStringIncludes,
} from "jsr:@std/assert@^1.0.11";
import {
  D1AuthRepository,
  type D1Database,
  type D1Statement,
} from "./d1_repository.ts";
import type { Ceremony, Passkey, Session, User } from "./types.ts";

class FakeD1 implements D1Database {
  calls: Array<{ query: string; values: unknown[] }> = [];
  firstResults: unknown[] = [];
  allResults: unknown[][] = [];
  prepare(query: string): D1Statement {
    const call = { query, values: [] as unknown[] };
    this.calls.push(call);
    return {
      bind: (...values: unknown[]) => {
        call.values = values;
        return this.prepareBound(call);
      },
      first: <T>() => Promise.resolve(this.firstResults.shift() as T ?? null),
      all: <T>() =>
        Promise.resolve({ results: (this.allResults.shift() ?? []) as T[] }),
      run: () => Promise.resolve({}),
    };
  }
  private prepareBound(
    call: { query: string; values: unknown[] },
  ): D1Statement {
    return {
      bind: (...values: unknown[]) => {
        call.values = values;
        return this.prepareBound(call);
      },
      first: <T>() => Promise.resolve(this.firstResults.shift() as T ?? null),
      all: <T>() =>
        Promise.resolve({ results: (this.allResults.shift() ?? []) as T[] }),
      run: () => Promise.resolve({}),
    };
  }
}

Deno.test("D1 repository maps every authentication operation", async () => {
  const db = new FakeD1();
  const repository = new D1AuthRepository(db);
  const user: User = {
    id: "u1",
    username: "alice",
    displayName: "Alice",
    createdAt: 1,
  };
  db.firstResults.push(user, user);
  assertEquals(await repository.findUserById("u1"), user);
  assertEquals(await repository.findUserByUsername("alice"), user);
  await repository.createUser(user);

  const row = {
    id: "k1",
    user_id: "u1",
    public_key: new Uint8Array([1, 2]).buffer,
    counter: 3,
    device_type: "multiDevice",
    backed_up: 1,
    transports: '["internal"]',
    created_at: 2,
  };
  db.allResults.push([row]);
  const listed = await repository.listPasskeys("u1");
  assertEquals(listed[0].transports, ["internal"]);
  assert(listed[0].backedUp);
  assertInstanceOf(listed[0].publicKey, Uint8Array);
  db.firstResults.push(row, null);
  assertEquals((await repository.findPasskey("k1"))?.id, "k1");
  assertEquals(await repository.findPasskey("missing"), null);

  const passkey: Passkey = { ...listed[0], backedUp: false };
  await repository.createPasskey(passkey);
  await repository.updatePasskeyCounter("k1", 4);
  const ceremony: Ceremony = {
    id: "c1",
    kind: "registration",
    challenge: "challenge",
    userId: "u1",
    username: "alice",
    displayName: "Alice",
    expiresAt: Date.now() + 1_000,
  };
  await repository.saveCeremony(ceremony);
  db.firstResults.push(ceremony, { ...ceremony, expiresAt: 0 });
  assertEquals(
    await repository.consumeCeremony("c1", "registration"),
    ceremony,
  );
  assertEquals(await repository.consumeCeremony("old", "registration"), null);
  const session: Session = {
    tokenHash: "hash",
    userId: "u1",
    expiresAt: Date.now() + 1_000,
  };
  await repository.createSession(session);
  db.firstResults.push(session);
  assertEquals(await repository.findSession("hash"), session);
  await repository.deleteSession("hash");

  assertEquals(db.calls.length, 14);
  assertStringIncludes(db.calls[0].query, "FROM users");
  assertEquals(db.calls[2].values, ["u1", "alice", "Alice", 1]);
  assertInstanceOf(db.calls[6].values[2], ArrayBuffer);
  assertEquals(db.calls[6].values[5], 0);
});
