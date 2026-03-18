import { Resend } from 'resend';
import { env } from '../config/env.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export class EmailDeliveryError extends Error {
  constructor(message: string, public readonly code: 'EMAIL_NOT_CONFIGURED' | 'EMAIL_SEND_FAILED') {
    super(message);
    this.name = 'EmailDeliveryError';
  }
}

const assertEmailConfiguration = () => {
  if (!env.RESEND_API_KEY?.trim()) {
    throw new EmailDeliveryError('Resend API key is not configured.', 'EMAIL_NOT_CONFIGURED');
  }

  if (!env.RESEND_FROM_EMAIL?.trim()) {
    throw new EmailDeliveryError('Resend sender email is not configured.', 'EMAIL_NOT_CONFIGURED');
  }

  if (!resend) {
    throw new EmailDeliveryError('Resend client could not be initialized.', 'EMAIL_NOT_CONFIGURED');
  }
};

export const sendPasswordResetCodeEmail = async (to: string, code: string) => {
  assertEmailConfiguration();
  const resendClient = resend;
  const fromEmail = env.RESEND_FROM_EMAIL?.trim();

  if (!resendClient || !fromEmail) {
    throw new EmailDeliveryError('Resend email configuration is incomplete.', 'EMAIL_NOT_CONFIGURED');
  }

  console.info('[email] sending password reset code', {
    to,
    from: fromEmail,
  });

  try {
    const result = await resendClient.emails.send({
      from: fromEmail,
      to,
      subject: 'CloudCanvas password reset code',
      text: `Your reset code is: ${code}`
    });

    if (result.error || !result.data?.id) {
      console.error('[email] resend API returned an error', {
        to,
        error: result.error,
        data: result.data
      });
      throw new EmailDeliveryError(result.error?.message || 'Resend did not accept the email send request.', 'EMAIL_SEND_FAILED');
    }

    console.info('[email] password reset code queued', {
      to,
      emailId: result.data.id
    });
  } catch (error) {
    console.error('[email] resend send failed', error);
    if (error instanceof EmailDeliveryError) throw error;
    throw new EmailDeliveryError(error instanceof Error ? error.message : 'Failed to send password reset email.', 'EMAIL_SEND_FAILED');
  }
};
