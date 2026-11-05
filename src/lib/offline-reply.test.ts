import { describe, expect, it } from "vitest";
import { offlineReply } from "./offline-reply";
import { seedDemo } from "./store/memory";

describe("offlineReply", () => {
  it("answers the dishes asked about from the inventory", () => {
    const s = seedDemo();
    const es = offlineReply(s, "¿Todavía hay quesabirrias?", "es");
    expect(es).toMatch(/Quesabirria: (quedan unas \d+|ya se acabó)\./);
    expect(es).toMatch(/no puedo apartar/);
    expect(offlineReply(s, "any consome left?", "en")).toMatch(/consom/i);
  });

  it("lists what is left when no dish is named", () => {
    const s = seedDemo();
    expect(offlineReply(s, "hola", "es")).toMatch(/^Hoy hay: /);
  });
});
