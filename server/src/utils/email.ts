import net from 'node:net';
import tls from 'node:tls';
import { randomUUID } from 'node:crypto';
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

type SmtpResponse = {
  code: number;
  lines: string[];
};

type SocketLike = net.Socket | tls.TLSSocket;

let verifiedTransport = false;
let lastVerifiedConfigKey: string | null = null;

const parseBoolean = (value?: string): boolean | null => {
  if (!value?.trim()) return null;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  throw new EmailDeliveryError('SMTP_SECURE must be true or false.', 'EMAIL_NOT_CONFIGURED');
};

const getMailConfig = (): MailConfig => {
  const missing = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'].filter((key) => {
    const value = env[key as keyof typeof env];
    return value === undefined || value === null || String(value).trim() === '';
  });

  if (missing.length) {
    throw new EmailDeliveryError(`Missing email configuration: ${missing.join(', ')}`, 'EMAIL_NOT_CONFIGURED');
  }

  const port = Number(env.SMTP_PORT);
  if (!Number.isInteger(port) || port <= 0) {
    throw new EmailDeliveryError('SMTP_PORT must be a positive integer.', 'EMAIL_NOT_CONFIGURED');
  }

  const explicitSecure = parseBoolean(env.SMTP_SECURE);
  const secure = explicitSecure ?? port === 465;

  return {
    host: env.SMTP_HOST!.trim(),
    port,
    secure,
    user: env.SMTP_USER!.trim(),
    pass: env.SMTP_PASS!,
    from: env.SMTP_FROM!.trim()
  };
};

const getConfigKey = (config: MailConfig) => `${config.host}:${config.port}:${config.secure}:${config.user}:${config.from}`;

const normalizeError = (message: string, defaultCode: EmailDeliveryErrorCode): EmailDeliveryError => {
  if (/auth/i.test(message) || /535/.test(message) || /535/.test(message)) {
    return new EmailDeliveryError('SMTP authentication failed.', 'EMAIL_AUTH_FAILED');
  }

  if (/5\d\d/.test(message) || /reject/i.test(message) || /denied/i.test(message)) {
    return new EmailDeliveryError(message, 'EMAIL_PROVIDER_REJECTED');
  }

  return new EmailDeliveryError(message, defaultCode);
};

const waitForSocketData = (socket: SocketLike) => new Promise<string>((resolve, reject) => {
  const onData = (chunk: Buffer | string) => {
    cleanup();
    resolve(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
  };
  const onError = (error: Error) => {
    cleanup();
    reject(error);
  };
  const onClose = () => {
    cleanup();
    reject(new Error('SMTP connection closed unexpectedly.'));
  };
  const cleanup = () => {
    socket.off('data', onData);
    socket.off('error', onError);
    socket.off('close', onClose);
  };
  socket.once('data', onData);
  socket.once('error', onError);
  socket.once('close', onClose);
});

const readSmtpResponse = async (socket: SocketLike): Promise<SmtpResponse> => {
  let buffer = '';
  let lines: string[] = [];

  while (true) {
    buffer += await waitForSocketData(socket);
    lines = buffer.split(/\r?\n/).filter(Boolean);
    if (!lines.length) continue;
    const last = lines[lines.length - 1];
    if (/^\d{3} /.test(last)) {
      return {
        code: Number(last.slice(0, 3)),
        lines
      };
    }
  }
};

const writeLine = (socket: SocketLike, line: string) => new Promise<void>((resolve, reject) => {
  socket.write(`${line}\r\n`, (error) => {
    if (error) reject(error);
    else resolve();
  });
});

const expectResponse = async (socket: SocketLike, expectedCodes: number[]) => {
  const response = await readSmtpResponse(socket);
  if (!expectedCodes.includes(response.code)) {
    throw normalizeError(response.lines.join(' | '), 'EMAIL_SEND_FAILED');
  }
  return response;
};

const openConnection = async (config: MailConfig): Promise<SocketLike> => {
  if (config.secure) {
    return await new Promise<tls.TLSSocket>((resolve, reject) => {
      const socket = tls.connect({ host: config.host, port: config.port, servername: config.host }, () => resolve(socket));
      socket.once('error', reject);
      socket.setTimeout(15000, () => socket.destroy(new Error('SMTP connection timed out.')));
    });
  }

  return await new Promise<net.Socket>((resolve, reject) => {
    const socket = net.createConnection({ host: config.host, port: config.port }, () => resolve(socket));
    socket.once('error', reject);
    socket.setTimeout(15000, () => socket.destroy(new Error('SMTP connection timed out.')));
  });
};

const upgradeToTls = async (socket: net.Socket, host: string): Promise<tls.TLSSocket> => {
  return await new Promise<tls.TLSSocket>((resolve, reject) => {
    const secureSocket = tls.connect({ socket, servername: host }, () => resolve(secureSocket));
    secureSocket.once('error', reject);
    secureSocket.setTimeout(15000, () => secureSocket.destroy(new Error('SMTP TLS handshake timed out.')));
  });
};

const smtpLogin = async (socket: SocketLike, user: string, pass: string) => {
  await writeLine(socket, 'AUTH LOGIN');
  await expectResponse(socket, [334]);
  await writeLine(socket, Buffer.from(user).toString('base64'));
  await expectResponse(socket, [334]);
  await writeLine(socket, Buffer.from(pass).toString('base64'));
  await expectResponse(socket, [235]);
};

const extractAddress = (fromValue: string) => {
  const match = fromValue.match(/<([^>]+)>/);
  return (match?.[1] || fromValue).trim();
};

const performSmtpSession = async (config: MailConfig, action: 'verify' | 'send', to?: string, text?: string) => {
  let socket = await openConnection(config);

  try {
    await expectResponse(socket, [220]);
    await writeLine(socket, `EHLO ${config.host}`);
    const ehlo = await expectResponse(socket, [250]);

    const supportsStartTls = ehlo.lines.some((line) => /STARTTLS/i.test(line));
    if (!config.secure) {
      if (!supportsStartTls) {
        throw new EmailDeliveryError('SMTP server does not advertise STARTTLS on the configured port.', 'EMAIL_NOT_CONFIGURED');
      }
      await writeLine(socket, 'STARTTLS');
      await expectResponse(socket, [220]);
      socket = await upgradeToTls(socket as net.Socket, config.host);
      await writeLine(socket, `EHLO ${config.host}`);
      await expectResponse(socket, [250]);
    }

    await smtpLogin(socket, config.user, config.pass);

    if (action === 'verify') {
      await writeLine(socket, 'QUIT');
      await expectResponse(socket, [221]);
      return;
    }

    const fromAddress = extractAddress(config.from);
    await writeLine(socket, `MAIL FROM:<${fromAddress}>`);
    await expectResponse(socket, [250]);
    await writeLine(socket, `RCPT TO:<${to}>`);
    await expectResponse(socket, [250, 251]);
    await writeLine(socket, 'DATA');
    await expectResponse(socket, [354]);

    const messageId = `<${randomUUID()}@${config.host}>`;
    const body = [
      `From: ${config.from}`,
      `To: ${to}`,
      'Subject: Froddle password reset code',
      `Message-ID: ${messageId}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      text || '',
      '.',
    ].join('\r\n');

    await new Promise<void>((resolve, reject) => socket.write(`${body}\r\n`, (error) => error ? reject(error) : resolve()));
    await expectResponse(socket, [250]);
    await writeLine(socket, 'QUIT');
    await expectResponse(socket, [221]);
  } catch (error) {
    if (error instanceof EmailDeliveryError) throw error;
    throw normalizeError(error instanceof Error ? error.message : 'SMTP send failed.', 'EMAIL_SEND_FAILED');
  } finally {
    if (!socket.destroyed) socket.destroy();
  }
};

export const validateEmailTransport = async () => {
  try {
    const config = getMailConfig();
    await performSmtpSession(config, 'verify');
    verifiedTransport = true;
    lastVerifiedConfigKey = getConfigKey(config);
    console.info('[email] SMTP transporter verified', {
      host: config.host,
      port: config.port,
      secure: config.secure,
      from: config.from
    });
    return { ok: true as const };
  } catch (error) {
    const mailError = error instanceof EmailDeliveryError ? error : normalizeError(error instanceof Error ? error.message : 'SMTP verification failed.', 'EMAIL_SEND_FAILED');
    verifiedTransport = false;
    lastVerifiedConfigKey = null;
    console.error('[email] SMTP transporter verification failed', {
      code: mailError.code,
      message: mailError.message
    });
    return { ok: false as const, error: mailError };
  }
};

export const sendPasswordResetCodeEmail = async (to: string, code: string) => {
  const config = getMailConfig();
  const configKey = getConfigKey(config);

  if (!verifiedTransport || lastVerifiedConfigKey !== configKey) {
    const verification = await validateEmailTransport();
    if (!verification.ok) throw verification.error;
  }

  console.info('[email] sending password reset code', {
    to,
    from: config.from,
    host: config.host,
    port: config.port,
    secure: config.secure
  });

  try {
    await performSmtpSession(
      config,
      'send',
      to,
      `Your Froddle password reset code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`
    );
    console.info('[email] password reset code sent', { to });
  } catch (error) {
    const mailError = error instanceof EmailDeliveryError ? error : normalizeError(error instanceof Error ? error.message : 'SMTP send failed.', 'EMAIL_SEND_FAILED');
    console.error('[email] failed to send password reset code', {
      to,
      code: mailError.code,
      message: mailError.message
    });
    throw mailError;
  }
};
