import sgMail from "@sendgrid/mail";

// SendGrid verifica só o remetente (Single Sender Verification, sem precisar de domínio próprio),
// e entrega pra qualquer destinatário — diferente do Resend sem domínio, que só entrega pro e-mail
// dono da conta. EMAIL_FROM precisa ser exatamente o endereço verificado como "single sender" no
// painel do SendGrid.
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const FROM = process.env.EMAIL_FROM;

export async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.SENDGRID_API_KEY || !FROM) {
    console.log(`[email] SENDGRID_API_KEY ou EMAIL_FROM não configurados, e-mail não enviado. Para: ${to} | Assunto: ${subject}`);
    return;
  }

  try {
    await sgMail.send({ to, from: FROM, subject, html });
  } catch (error) {
    console.error(`[email] Falha ao enviar para ${to}:`, error);
  }
}
