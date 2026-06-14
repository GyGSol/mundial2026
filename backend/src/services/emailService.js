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
