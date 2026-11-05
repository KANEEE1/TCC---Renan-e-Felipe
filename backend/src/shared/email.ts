import { Resend } from "resend";

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
