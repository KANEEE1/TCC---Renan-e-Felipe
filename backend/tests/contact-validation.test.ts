import { describe, expect, it, vi } from "vitest";
import { validarCelular } from "../src/shared/celular.js";

const { dominioRecebeEmail } = await vi.importActual<typeof import("../src/shared/email-domain.js")>("../src/shared/email-domain.js");

const erroDns = (code: string) => Object.assign(new Error(code), { code });
const dns = (mx: unknown, a: unknown = []) => ({
  resolveMx: vi.fn(async () => {
    if (mx instanceof Error) throw mx;
    return mx as { exchange: string; priority: number }[];
  }),
  resolve4: vi.fn(async () => {
    if (a instanceof Error) throw a;
    return a as string[];
  })
});

describe("validarCelular", () => {
  it.each(["(11) 98765-4321", "11987654321", "11 9 8765 4321", "+55 (11) 98765-4321", "5511987654321"])("accepts and formats %s", (valor) => {
    expect(validarCelular(valor)).toBe("(11) 98765-4321");
  });

  it.each([
    ["landline", "(11) 3333-4444"],
    ["no area code", "98765-4321"],
    ["area code that does not exist", "(20) 98765-4321"],
    ["mobile without the leading 9", "(11) 88765-4321"],
    ["too many digits", "(11) 98765-43210"],
    ["text", "abc"],
    ["blank", "   "]
  ])("rejects %s", (_caso, valor) => {
    expect(() => validarCelular(valor)).toThrow("celular válido");
  });

  it("lets an empty phone through", () => {
    expect(validarCelular(undefined)).toBeUndefined();
    expect(validarCelular(null)).toBeNull();
  });
});

describe("dominioRecebeEmail", () => {
  it("accepts a domain with a mail server, asking only about the part after the @", async () => {
    const fake = dns([{ exchange: "mx.gmail.com", priority: 5 }]);
    expect(await dominioRecebeEmail("a@b@gmail.com", fake as never)).toBe(true);
    expect(fake.resolveMx).toHaveBeenCalledWith("gmail.com");
  });

  it("rejects a domain that does not exist", async () => {
    expect(await dominioRecebeEmail("a@gmail.con", dns(erroDns("ENOTFOUND"), erroDns("ENOTFOUND")) as never)).toBe(false);
  });

  it("rejects a null MX, which declares the domain does not receive mail", async () => {
    expect(await dominioRecebeEmail("a@x.com", dns([{ exchange: "", priority: 0 }]) as never)).toBe(false);
    expect(await dominioRecebeEmail("a@x.com", dns([{ exchange: ".", priority: 0 }]) as never)).toBe(false);
  });

  it("falls back to the domain's own address when there is no MX", async () => {
    expect(await dominioRecebeEmail("a@x.com", dns(erroDns("ENODATA"), ["1.2.3.4"]) as never)).toBe(true);
    expect(await dominioRecebeEmail("a@x.com", dns(erroDns("ENODATA"), erroDns("ENODATA")) as never)).toBe(false);
  });

  it("does not block the signup when DNS is unavailable", async () => {
    expect(await dominioRecebeEmail("a@x.com", dns(erroDns("ETIMEOUT")) as never)).toBe(true);
    expect(await dominioRecebeEmail("a@x.com", dns(erroDns("ENODATA"), erroDns("ESERVFAIL")) as never)).toBe(true);
  });
});
