import { describe, expect, it } from "vitest";
import { replyLanguage } from "./language";

const ask = (content: string) => [{ role: "user", content }];

describe("replyLanguage", () => {
  it("answers in the language the customer writes in", () => {
    expect(replyLanguage(ask("Do you still have quesabirrias?"), "es")).toBe("en");
    expect(replyLanguage(ask("I want 3 tacos please"), "es")).toBe("en");
    expect(replyLanguage(ask("¿Todavía hay birria?"), "en")).toBe("es");
    expect(replyLanguage(ask("apartame 2 tacos porfa"), "en")).toBe("es");
  });

  it("follows the last message when the customer switches", () => {
    const chat = [...ask("hola, hay consomé?"), { role: "assistant", content: "Sí" }, ...ask("can I order two?")];
    expect(replyLanguage(chat, "es")).toBe("en");
  });

  it("keeps the earlier language when a message gives no clue", () => {
    const chat = [...ask("I want 2 quesabirrias"), { role: "assistant", content: "Name?" }, ...ask("Ana Ramírez")];
    expect(replyLanguage(chat, "es")).toBe("en");
    expect(replyLanguage(ask("Ana Ramírez"), "en")).toBe("en");
    expect(replyLanguage(ask("3"), "en")).toBe("en");
    expect(replyLanguage(ask("ok"), "es")).toBe("es");
  });
});
