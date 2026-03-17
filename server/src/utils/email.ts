import { Resend } from 'resend';
import { env } from '../config/env.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export const sendPasswordResetCodeEmail = async (to: string, code: string) => {
  if (!resend || !env.RESEND_FROM_EMAIL) {
    console.warn('[email] Resend is not configured, skipping reset email send.');
    return;
  }

  try {
    await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to,
      subject: 'CloudCanvas password reset code',
      text: `Your reset code is: ${code}`
    });
  } catch (error) {
    console.error('[email] resend send failed', error);
    throw error;
  }
};
