import nodemailer from 'nodemailer';

const isDev = process.env.NODE_ENV === 'development';

const transporter = isDev ? null : nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

async function sendMail(to: string, subject: string, html: string) {
    if (isDev) {
        console.log(`[DEV EMAIL] To: ${to}`);
        console.log(`[DEV EMAIL] Subject: ${subject}`);
        console.log(`[DEV EMAIL] Preview: ${html.substring(0, 200)}...`);
        return;
    }

    if (!transporter) {
        throw new Error('Email transporter not configured');
    }

    await transporter.sendMail({
        from: `"DocSign" <${process.env.SMTP_FROM}>`,
        to,
        subject,
        html,
    });
}

export async function sendSigningLink(to: string, token: string, docName: string, ownerEmail?: string) {
    const url = `${process.env.CLIENT_URL}/sign/${token}`;
    await sendMail(
        to,
        `Please sign: "${docName}"`,
        `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#0F2044">You have a document to sign</h2>
        <p>You've been asked to review and sign:</p>
        <p><strong>${docName}</strong></p>
        ${ownerEmail ? `<p style="color:#6B7280;font-size:13px">Requested by: ${ownerEmail}</p>` : ''}
        <a href="${url}"
           style="display:inline-block;margin:20px 0;padding:12px 28px;
                  background:#1D4ED8;color:#fff;text-decoration:none;
                  border-radius:8px;font-weight:bold">
          Sign Document
        </a>
        <p style="color:#6B7280;font-size:13px">Link expires in 72 hours.</p>
      </div>
    `
    );
}

export async function sendSignedNotification(ownerEmail: string, docName: string, signerEmail: string) {
    await sendMail(
        ownerEmail,
        `Document signed: "${docName}"`,
        `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#0F2044">Document Signed</h2>
        <p>Your document has been successfully signed:</p>
        <p><strong>${docName}</strong></p>
        <p>Signed by: <strong>${signerEmail}</strong></p>
        <p style="color:#6B7280;font-size:13px">You can download the signed document from your dashboard.</p>
      </div>
    `
    );
}

export async function sendRejectedNotification(ownerEmail: string, docName: string, signerEmail: string, reason: string) {
    await sendMail(
        ownerEmail,
        `Document rejected: "${docName}"`,
        `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#DC2626">Document Rejected</h2>
        <p>Your document has been rejected:</p>
        <p><strong>${docName}</strong></p>
        <p>Rejected by: <strong>${signerEmail}</strong></p>
        <div style="background:#FEF2F2;padding:12px;border-radius:8px;margin:12px 0">
          <p style="margin:0;color:#991B1B"><strong>Reason:</strong> ${reason}</p>
        </div>
      </div>
    `
    );
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
    await sendMail(
        to,
        'Reset your DocSign password',
        `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#0F2044">Reset Your Password</h2>
        <p>You requested to reset your DocSign password.</p>
        <a href="${resetUrl}"
           style="display:inline-block;margin:20px 0;padding:12px 28px;
                  background:#1D4ED8;color:#fff;text-decoration:none;
                  border-radius:8px;font-weight:bold">
          Reset Password
        </a>
        <p style="color:#6B7280;font-size:13px">This link expires in 1 hour.</p>
        <p style="color:#6B7280;font-size:13px">If you didn't request this, please ignore this email.</p>
      </div>
    `
    );
}
