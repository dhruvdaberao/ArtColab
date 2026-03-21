import { Resend } from 'resend';
import { env } from '../config/env.js';

type EmailDeliveryErrorCode =
  | 'EMAIL_NOT_CONFIGURED'
  | 'EMAIL_PROVIDER_REJECTED'
  | 'EMAIL_SEND_FAILED';

export class EmailDeliveryError extends Error {
  constructor(message: string, public readonly code: EmailDeliveryErrorCode) {
    super(message);
    this.name = 'EmailDeliveryError';
  }
}

const normalizeMessage = (value?: string | null) => value?.trim() || '';

const getEmailConfig = () => {
  const apiKey = normalizeMessage(env.RESEND_API_KEY);
  const from = normalizeMessage(env.RESEND_FROM);
  const missing = [
    !apiKey ? 'RESEND_API_KEY' : null,
    !from ? 'RESEND_FROM' : null
  ].filter(Boolean) as string[];

  if (missing.length) {
    throw new EmailDeliveryError(`Missing email configuration: ${missing.join(', ')}`, 'EMAIL_NOT_CONFIGURED');
  }

  return { apiKey, from };
};

const getResendClient = () => {
  const { apiKey } = getEmailConfig();
  return new Resend(apiKey);
};

const getOtpExpiryMinutes = () => env.OTP_EXPIRES_MINUTES;

const buildOtpEmailHtml = (otp: string) => {
  const expiryMinutes = getOtpExpiryMinutes();

  return `
    <div style="margin:0;padding:32px 16px;background:#f4f7fb;font-family:Arial,sans-serif;color:#122033;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #dbe5f0;box-shadow:0 10px 30px rgba(18,32,51,0.08);">
        <div style="background:linear-gradient(135deg,#1d4ed8,#06b6d4);padding:32px 24px;text-align:center;color:#ffffff;">
          <div style="font-size:13px;letter-spacing:0.18em;text-transform:uppercase;font-weight:700;opacity:0.9;">Froodle</div>
          <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;">Password reset code</h1>
        </div>
        <div style="padding:32px 24px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">We received a request to reset your Froodle password. Use this one-time code to continue:</p>
          <div style="margin:24px 0;padding:20px 16px;border-radius:16px;background:#eff6ff;border:1px solid #bfdbfe;text-align:center;">
            <div style="font-size:42px;line-height:1;letter-spacing:0.32em;font-weight:800;color:#1d4ed8;">${otp}</div>
          </div>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.7;">This code expires in <strong>${expiryMinutes} minutes</strong>.</p>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#526277;">If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
        </div>
      </div>
    </div>
  `;
};

const normalizeError = (error: unknown): EmailDeliveryError => {
  if (error instanceof EmailDeliveryError) return error;

  const message = error instanceof Error ? error.message : 'Resend email send failed.';
  const typed = error as { statusCode?: number; code?: string; response?: { data?: { error?: string; message?: string } } } | undefined;
  const providerMessage = typed?.response?.data?.message || typed?.response?.data?.error || message;

  if ((typed?.statusCode && typed.statusCode >= 400 && typed.statusCode < 500) || /invalid|forbidden|unauthorized|domain/i.test(providerMessage)) {
    return new EmailDeliveryError(`Resend rejected the email request: ${providerMessage}`, 'EMAIL_PROVIDER_REJECTED');
  }

  return new EmailDeliveryError(`Resend send failed: ${providerMessage}`, 'EMAIL_SEND_FAILED');
};

export const validateEmailTransport = async () => {
  try {
    const config = getEmailConfig();
    console.info('[email] Resend configuration verified', {
      from: config.from,
      provider: 'resend'
    });
    return { ok: true as const };
  } catch (error) {
    const mailError = normalizeError(error);
    console.error('[email] Resend configuration failed', {
      code: mailError.code,
      message: mailError.message
    });
    return { ok: false as const, error: mailError };
  }
};

export const sendOTPEmail = async (to: string, otp: string) => {
  const config = getEmailConfig();
  const resend = getResendClient();
  const expiryMinutes = getOtpExpiryMinutes();

  try {
    const { error } = await resend.emails.send({
      from: config.from,
      to,
      subject: 'Your Froodle Password Reset Code',
      text: `Your Froodle password reset code is ${otp}. It expires in ${expiryMinutes} minutes. If you did not request this, you can ignore this email.`,
      html: buildOtpEmailHtml(otp)
    });

    if (error) {
      throw new EmailDeliveryError(`Resend API error: ${error.message}`, 'EMAIL_PROVIDER_REJECTED');
    }

    console.info('[email] password reset OTP sent via Resend', { to, provider: 'resend' });
  } catch (error) {
    const mailError = normalizeError(error);
    console.error('[email] failed to send password reset OTP via Resend', {
      to,
      code: mailError.code,
      message: mailError.message
    });
    throw mailError;
  }
};
