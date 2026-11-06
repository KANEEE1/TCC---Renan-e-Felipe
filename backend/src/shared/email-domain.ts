import { Resolver } from "node:dns/promises";

type Dns = Pick<Resolver, "resolveMx" | "resolve4">;

// Só "domínio não existe" e "sem esse registro" são respostas definitivas.
const semRegistro = (error: unknown) => ["ENOTFOUND", "ENODATA"].includes((error as NodeJS.ErrnoException).code ?? "");

// Consulta o DNS para saber se o domínio do e-mail recebe mensagens. Não prova que a caixa existe (isso é o link de
// confirmação). Se a consulta falhar (rede, timeout), responde true: instabilidade não pode bloquear um e-mail válido.
export async function dominioRecebeEmail(email: string, dns: Dns = new Resolver({ timeout: 3000, tries: 1 })) {
  const dominio = email.slice(email.lastIndexOf("@") + 1);
  try {
    const servidores = await dns.resolveMx(dominio);
    // MX nulo (RFC 7505): o domínio declara que não recebe e-mail.
    return servidores.some((mx) => mx.exchange !== "" && mx.exchange !== ".");
  } catch (error) {
    if (!semRegistro(error)) return true;
  }
  // Sem MX, a entrega vai para o endereço do próprio domínio (RFC 5321).
  try {
    await dns.resolve4(dominio);
    return true;
  } catch (error) {
    return !semRegistro(error);
  }
}
