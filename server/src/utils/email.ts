import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

type EmailDeliveryErrorCode =
  | 'EMAIL_NOT_CONFIGURED'
  | 'EMAIL_AUTH_FAILED'
  | 'EMAIL_PROVIDER_REJECTED'
  | 'EMAIL_SEND_FAILED';

export class EmailDeliveryError extends Error {
  constructor(message: string, public readonly code: EmailDeliveryErrorCode) {
    super(message);
    this.name = 'EmailDeliveryError';
  }
}

type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;
let cachedConfigKey: string | null = null;

const normalizeMessage = (value?: string | null) => value?.trim() || '';

const parsePort = (value: number | string | undefined) => {
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0) {
    throw new EmailDeliveryError('SMTP_PORT must be a positive integer.', 'EMAIL_NOT_CONFIGURED');
  }
  return port;
};

const getMailConfig = (): MailConfig => {
  const fromValue = normalizeMessage(env.EMAIL_FROM ?? env.SMTP_FROM);
  const values = {
    SMTP_HOST: normalizeMessage(env.SMTP_HOST),
    SMTP_PORT: env.SMTP_PORT,
    SMTP_USER: normalizeMessage(env.SMTP_USER),
    SMTP_PASS: normalizeMessage(env.SMTP_PASS),
    EMAIL_FROM: fromValue
  };

  const missing = Object.entries(values)
    .filter(([, value]) => value === '' || value === undefined || value === null)
    .map(([key]) => key);

  if (missing.length) {
    throw new EmailDeliveryError(`Missing email configuration: ${missing.join(', ')}`, 'EMAIL_NOT_CONFIGURED');
  }

  const port = parsePort(values.SMTP_PORT);
  const secure = port === 465;

  return {
    host: values.SMTP_HOST,
    port,
    secure,
    user: values.SMTP_USER,
    pass: values.SMTP_PASS,
    from: fromValue
  };
};

const getConfigKey = (config: MailConfig) => `${config.host}:${config.port}:${config.secure}:${config.user}:${config.from}`;

const normalizeError = (error: unknown): EmailDeliveryError => {
  const message = error instanceof Error ? error.message : 'SMTP send failed.';
  const typed = error as { code?: string; responseCode?: number; command?: string } | undefined;

  if (typed?.code === 'EAUTH' || typed?.responseCode === 535) {
    return new EmailDeliveryError('SMTP authentication failed. Verify SMTP_USER and SMTP_PASS (use a Gmail App Password, not your normal password).', 'EMAIL_AUTH_FAILED');
  }

  if (typed?.code === 'ECONNECTION' || typed?.code === 'ESOCKET' || typed?.code === 'ETIMEDOUT') {
    return new EmailDeliveryError(`SMTP connection failed: ${message}`, 'EMAIL_SEND_FAILED');
  }

  if ((typed?.responseCode && typed.responseCode >= 500) || /rejected|denied|invalid recipient/i.test(message)) {
    return new EmailDeliveryError(message, 'EMAIL_PROVIDER_REJECTED');
  }

  return new EmailDeliveryError(message, 'EMAIL_SEND_FAILED');
};

export const createTransporter = () => {
  const config = getMailConfig();
  const configKey = getConfigKey(config);

  if (cachedTransporter && cachedConfigKey === configKey) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    tls: {
      servername: config.host,
      minVersion: 'TLSv1.2'
    }
  });

  cachedConfigKey = configKey;
  return cachedTransporter;
};

export const validateEmailTransport = async () => {
  try {
    const config = getMailConfig();
    const transporter = createTransporter();
    await transporter.verify();
    console.info('[email] SMTP transporter verified', {
      host: config.host,
      port: config.port,
      secure: config.secure,
      from: config.from
    });
    return { ok: true as const };
  } catch (error) {
    const mailError = error instanceof EmailDeliveryError ? error : normalizeError(error);
    console.error('[email] SMTP transporter verification failed', {
      code: mailError.code,
      message: mailError.message
    });
    return { ok: false as const, error: mailError };
  }
};

export const sendOTPEmail = async (to: string, otp: string) => {
  const config = getMailConfig();
  const transporter = createTransporter();

  try {
    await transporter.sendMail({
      from: config.from,
      to,
      subject: 'Your Froodle Password Reset Code',
      text: `Your Froodle password reset code is ${otp}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
          <h2 style="margin-bottom: 16px;">Froodle password reset</h2>
          <p style="font-size: 16px; line-height: 1.6;">Use the code below to reset your password:</p>
          <div style="margin: 24px 0; padding: 18px; text-align: center; background: #f3f4f6; border-radius: 12px; font-size: 32px; letter-spacing: 8px; font-weight: 700;">
            ${otp}
          </div>
          <p style="font-size: 15px; line-height: 1.6;">This code expires in <strong>10 minutes</strong>.</p>
          <p style="font-size: 14px; line-height: 1.6; color: #6b7280;">If you did not request a password reset, you can safely ignore this email.</p>
        </div>
      `
    });

    console.info('[email] password reset OTP sent', { to });
  } catch (error) {
    const mailError = normalizeError(error);
    console.error('[email] failed to send password reset OTP', {
      to,
      code: mailError.code,
      message: mailError.message
    });
    throw mailError;
  }
};
