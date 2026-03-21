declare module 'nodemailer/lib/smtp-transport' {
  export interface SentMessageInfo {
    messageId?: string;
    accepted?: string[];
    rejected?: string[];
    response?: string;
  }

  const SMTPTransport: {
    prototype: SentMessageInfo;
  };

  export default SMTPTransport;
}

declare module 'nodemailer' {
  export interface SendMailOptions {
    from?: string;
    to?: string;
    subject?: string;
    text?: string;
    html?: string;
  }

  export interface Transporter<T = unknown> {
    verify(): Promise<true>;
    sendMail(mailOptions: SendMailOptions): Promise<T>;
  }

  const nodemailer: {
    createTransport(options: Record<string, unknown>): Transporter;
  };

  export default nodemailer;
}
