import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

function isSmtpConfigured() {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass);
}

function createTransporter() {
  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    requireTLS: env.smtpPort === 587,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });
}

export async function sendPasswordResetEmail({ to, name, temporaryPassword }) {
  const appName = env.appPublicName;
  const loginUrl = `${env.clientOrigin.replace(/\/$/, '')}/login`;
  const subject = `${appName} — clave provisoria`;
  const text = [
    `Hola${name ? ` ${name}` : ''},`,
    '',
    `Recibimos una solicitud para restablecer tu contraseña en ${appName}.`,
    '',
    `Tu clave provisoria es: ${temporaryPassword}`,
    '',
    'Ingresá con esa clave en la app y definí una contraseña nueva.',
    `Link de ingreso: ${loginUrl}`,
    '',
    'Esta clave caduca en 24 horas. Si no pediste este cambio, ignorá este mensaje.',
  ].join('\n');

  if (!isSmtpConfigured()) {
    console.info(
      `[emailService] SMTP no configurado — clave provisoria para ${to}: ${temporaryPassword}`
    );
    return { delivered: false, logged: true };
  }

  const transporter = createTransporter();
  try {
    await transporter.sendMail({
      from: env.smtpFrom,
      to,
      subject,
      text,
    });
  } catch (err) {
    console.error('[emailService] Error al enviar clave provisoria:', err?.message || err);
    const error = new Error('EMAIL_DELIVERY_FAILED');
    error.cause = err;
    throw error;
  }

  return { delivered: true, logged: false };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildFubolsCupQualificationEmailContent({ name, groupName, cupUrl }) {
  const appName = env.appPublicName;
  const greeting = name ? `Hola ${name},` : 'Hola,';
  const subject = `${appName} — estás clasificado a la Copa Fubols`;

  const text = [
    greeting,
    '',
    '¡Estás clasificado a la Copa Fubols!',
    '',
    `Tu grupo "${groupName}" ya tiene el cuadro de playoffs. Entrá a ver tu cruce y los partidos del Mundial que definen cada duelo.`,
    '',
    `Ver la Copa Fubols: ${cupUrl}`,
    '',
    '¡Mucha suerte!',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#e2e8f0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f172a;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
        <tr><td style="padding:40px 28px 24px;text-align:center;background:linear-gradient(180deg,#14532d 0%,#1e293b 100%);">
          <p style="margin:0 0 12px;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;color:#86efac;">${escapeHtml(appName)}</p>
          <h1 style="margin:0;font-size:34px;line-height:1.15;font-weight:800;color:#f8fafc;">Estás clasificado<br>a la Copa Fubols</h1>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#cbd5e1;">${escapeHtml(greeting)}</p>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#cbd5e1;">Tu grupo <strong style="color:#f8fafc;">${escapeHtml(groupName)}</strong> ya tiene el cuadro de playoffs. Mirá tu cruce y los partidos del Mundial que definen cada duelo.</p>
          <p style="margin:0 0 28px;text-align:center;">
            <a href="${escapeHtml(cupUrl)}" style="display:inline-block;padding:14px 28px;background:#22c55e;color:#052e16;font-size:17px;font-weight:700;text-decoration:none;border-radius:999px;">Ver la Copa Fubols</a>
          </p>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#94a3b8;text-align:center;">Si el botón no funciona, copiá este enlace:<br><a href="${escapeHtml(cupUrl)}" style="color:#86efac;word-break:break-all;">${escapeHtml(cupUrl)}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

export async function sendFubolsCupQualificationEmail({ to, name, groupName, cupUrl }) {
  const { subject, text, html } = buildFubolsCupQualificationEmailContent({
    name,
    groupName,
    cupUrl,
  });

  if (!isSmtpConfigured()) {
    console.info(`[emailService] SMTP no configurado — Copa Fubols para ${to}: ${cupUrl}`);
    return { delivered: false, logged: true };
  }

  const transporter = createTransporter();
  try {
    await transporter.sendMail({
      from: env.smtpFrom,
      to,
      subject,
      text,
      html,
    });
  } catch (err) {
    console.error('[emailService] Error al enviar mail Copa Fubols:', err?.message || err);
    const error = new Error('EMAIL_DELIVERY_FAILED');
    error.cause = err;
    throw error;
  }

  return { delivered: true, logged: false };
}
