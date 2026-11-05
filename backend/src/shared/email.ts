import { Resend } from "resend";

// LIMITAÇÃO CONHECIDA: sem domínio verificado no Resend (resend.com/domains), a conta fica em modo
// sandbox e só entrega e-mail para o endereço dono da conta — qualquer outro destinatário falha com
// 403 "You can only send testing emails to your own email address". Isso é capturado abaixo e só
// vira log, então a aplicação segue normalmente, mas NENHUM e-mail chega de verdade em produção
// enquanto não houver um domínio próprio pra verificar. Sem domínio hoje (2026-11), aceito como
// limitação conhecida do projeto.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM = process.env.EMAIL_FROM ?? "Cursinho Popular <onboarding@resend.dev>";

export async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) {
    console.log(`[email] RESEND_API_KEY não configurada, e-mail não enviado. Para: ${to} | Assunto: ${subject}`);
    return;
  }

  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) {
    console.error(`[email] Falha ao enviar para ${to}:`, error);
  }
}
