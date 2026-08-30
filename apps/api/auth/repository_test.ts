import { assertEquals, assertRejects } from "jsr:@std/assert@^1.0.11";
import { MemoryAuthRepository } from "./repository.ts";
import type { Ceremony, Passkey, Session, User } from "./types.ts";

Deno.test("memory repository manages the complete authentication lifecycle", async () => {
  const repository = new MemoryAuthRepository();
  const user: User = {
    id: "user-1",
    username: "alice",
    displayName: "Alice",
    createdAt: 1,
  };
  await repository.createUser(user);
  assertEquals(await repository.findUserById(user.id), user);
  assertEquals(await repository.findUserByUsername("alice"), user);
  assertEquals(await repository.findUserById("missing"), null);
  await assertRejects(() => repository.createUser({ ...user, id: "user-2" }));

  const passkey: Passkey = {
    id: "key-1",
    userId: user.id,
    publicKey: new Uint8Array([1, 2]),
    counter: 0,
    deviceType: "multiDevice",
    backedUp: true,
    transports: ["internal"],
    createdAt: 2,
  };
  await repository.createPasskey(passkey);
  assertEquals(await repository.findPasskey(passkey.id), passkey);
  assertEquals(await repository.findPasskey("missing"), null);
  assertEquals(await repository.listPasskeys(user.id), [passkey]);
  assertEquals(await repository.listPasskeys("other"), []);
  await repository.updatePasskeyCounter(passkey.id, 4);
  assertEquals((await repository.findPasskey(passkey.id))?.counter, 4);
  await repository.updatePasskeyCounter("missing", 9);

  const ceremony: Ceremony = {
    id: "ceremony-1",
    kind: "registration",
    challenge: "challenge",
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    expiresAt: Date.now() + 1_000,
  };
  await repository.saveCeremony(ceremony);
  assertEquals(
    await repository.consumeCeremony(ceremony.id, "registration"),
    ceremony,
  );
  assertEquals(
    await repository.consumeCeremony(ceremony.id, "registration"),
    null,
  );
  await repository.saveCeremony({ ...ceremony, id: "wrong-kind" });
  assertEquals(
    await repository.consumeCeremony("wrong-kind", "authentication"),
    null,
  );
  await repository.saveCeremony({
    ...ceremony,
    id: "expired",
    expiresAt: Date.now() - 1,
  });
  assertEquals(
    await repository.consumeCeremony("expired", "registration"),
    null,
  );

  const session: Session = {
    tokenHash: "hash",
    userId: user.id,
    expiresAt: Date.now() + 1_000,
  };
  await repository.createSession(session);
  assertEquals(await repository.findSession(session.tokenHash), session);
  assertEquals(await repository.findSession("missing"), null);
  await repository.createSession({
    ...session,
    tokenHash: "expired",
    expiresAt: Date.now() - 1,
  });
  assertEquals(await repository.findSession("expired"), null);
  await repository.deleteSession(session.tokenHash);
  assertEquals(await repository.findSession(session.tokenHash), null);
});
