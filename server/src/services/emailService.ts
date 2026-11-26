import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '../config/environment';
import { IncidentRecord } from '../types/incident';

let transporter: Transporter | null = null;
let isMockTransport = false;
let etherealInitPromise: Promise<Transporter | null> | null = null;

async function getTransporter(): Promise<Transporter | null> {
  if (transporter) return transporter;

  // 1. Custom configured SMTP host
  if (env.smtp.host && env.smtp.host.trim()) {
    try {
      const cleanPass = env.smtp.pass ? env.smtp.pass.replace(/\s+/g, '') : undefined;
      transporter = nodemailer.createTransport({
        host: env.smtp.host.trim(),
        port: env.smtp.port,
        secure: env.smtp.secure,
        pool: true,
        maxConnections: 3,
        maxMessages: 100,
        auth: (env.smtp.user && cleanPass)
          ? { user: env.smtp.user.trim(), pass: cleanPass }
          : undefined,
      });
      isMockTransport = false;
      console.log(`[EmailService] Initialized custom SMTP transport for host: ${env.smtp.host}:${env.smtp.port}`);
      return transporter;
    } catch (err: any) {
      console.error('[EmailService] Failed to initialize custom SMTP transporter:', err.message);
      transporter = null;
    }
  }

  // 2. Automated Ethereal test mail fallback when custom SMTP is unconfigured
  if (!etherealInitPromise) {
    etherealInitPromise = (async () => {
      try {
        console.log('[EmailService] Initializing automated Ethereal mail transport for live dispatching...');
        const testAccount = await nodemailer.createTestAccount();
        const ethereal = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        console.log(`[EmailService] Ethereal live mail transport ready (${testAccount.user}). Dispatches will produce accessible preview URLs.`);
        return ethereal;
      } catch (err: any) {
        console.warn('[EmailService] Could not initialize Ethereal fallback transporter:', err.message);
        return null;
      }
    })();
  }

  transporter = await etherealInitPromise;
  return transporter;
}

/**
 * Allows automated tests to inject a mock transporter or reset it.
 */
export function setMockTransporter(mock: Transporter | null): void {
  transporter = mock;
  isMockTransport = !!mock;
}

function formatDateTime(isoString?: string): string {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  const pad = (n: number) => n.toString().padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Sends an HTML email alert for a verified new hazard incident.
 * Does not throw; returns true on delivery success, false on failure or missing config.
 */
export async function sendIncidentAlertEmail(
  mallName: string,
  recipientEmail: string | string[] | null | undefined,
  incident: IncidentRecord
): Promise<boolean> {
  const recipients: string[] = [];
  if (Array.isArray(recipientEmail)) {
    recipients.push(...recipientEmail.map(e => (typeof e === 'string' ? e.trim() : '')).filter(Boolean));
  } else if (recipientEmail && typeof recipientEmail === 'string') {
    recipients.push(...recipientEmail.split(',').map(e => e.trim()).filter(Boolean));
  }

  if (recipients.length === 0) {
    console.warn(`[EmailService] No recipient email configured for mall '${incident.mallId}'. Skipping email alert.`);
    return false;
  }

  const activeTransporter = await getTransporter();

  const formattedType = incident.detectionType.toUpperCase();
  const locationDesc = incident.roomName
    ? `${incident.roomName} (Floor ${incident.floorId})`
    : `Floor ${incident.floorId}`;
  const confidencePct = Math.round(incident.confidence * 100);
  const subject = `EvacAI Alert: ${formattedType} Detected at ${mallName}`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .card { background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; max-width: 600px; margin: 0 auto; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; padding: 24px; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; }
    .header p { margin: 6px 0 0; opacity: 0.9; font-size: 14px; }
    .body { padding: 24px; }
    .alert-badge { display: inline-block; background-color: #fee2e2; color: #991b1b; font-weight: 700; padding: 4px 12px; border-radius: 9999px; font-size: 13px; margin-bottom: 16px; text-transform: uppercase; }
    .table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
    .table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
    .table td.label { font-weight: 600; color: #64748b; width: 35%; }
    .table td.value { font-weight: 500; color: #0f172a; }
    .footer { padding: 16px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>⚠️ Emergency Safety Alert</h1>
      <p>Automated hazard detection notification from EvacAI</p>
    </div>
    <div class="body">
      <div class="alert-badge">Hazard Detected: ${formattedType}</div>
      <table class="table">
        <tr>
          <td class="label">Shopping Mall</td>
          <td class="value">${mallName}</td>
        </tr>
        <tr>
          <td class="label">Hazard Type</td>
          <td class="value" style="color: #dc2626; font-weight: 700;">${formattedType}</td>
        </tr>
        <tr>
          <td class="label">Detection Camera</td>
          <td class="value">${incident.cameraName || 'CCTV Camera'}</td>
        </tr>
        <tr>
          <td class="label">Location</td>
          <td class="value">${locationDesc}</td>
        </tr>
        <tr>
          <td class="label">Detection Time</td>
          <td class="value">${formatDateTime(incident.detectedAt)}</td>
        </tr>
        <tr>
          <td class="label">Model Confidence</td>
          <td class="value">${confidencePct}% (${incident.confidence})</td>
        </tr>
        <tr>
          <td class="label">Incident ID</td>
          <td class="value" style="font-family: monospace;">${incident.incidentId}</td>
        </tr>
      </table>
      <p style="margin-top: 20px; font-size: 13px; color: #64748b; line-height: 1.5;">
        Please log in to your EvacAI Mall Management Dashboard immediately to inspect the surveillance feed, review annotated evidence, and initiate emergency response protocols.
      </p>
    </div>
    <div class="footer">
      EvacAI Autonomous Life Safety & Incident Pipeline &bull; This is an automated notification.
    </div>
  </div>
</body>
</html>
  `.trim();

  if (!activeTransporter) {
    console.info(
      `[EmailService] Note: SMTP is unconfigured. Simulated alert email for incident '${incident.incidentId}' to '${recipients.join(', ')}' (Subject: ${subject})`
    );
    return false;
  }

  try {
    const toAddress = recipients.join(', ');
    const info = await activeTransporter.sendMail({
      from: env.smtp.from,
      to: toAddress,
      subject,
      html: htmlContent,
    });
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[EmailService] ✉️ Alert email dispatched for incident '${incident.incidentId}' to [${toAddress}]. View Live Preview: ${previewUrl}`);
    } else {
      console.log(`[EmailService] ✉️ Alert email successfully dispatched for incident '${incident.incidentId}' to [${toAddress}]. MessageId: ${info.messageId}`);
    }
    return true;
  } catch (error: any) {
    console.error(`[EmailService] Failed to send alert email for incident '${incident.incidentId}':`, error.message);
    return false;
  }
}

/**
 * Sends a timescale observation email for an ongoing hazard during continuous monitoring.
 * Dispatched on 15-minute intervals when fire is still present on the same camera.
 */
export async function sendTimescaleObservationEmail(
  mallName: string,
  recipientEmail: string | string[] | null | undefined,
  incident: IncidentRecord,
  observationIndex: number,
  observedAt: string,
  timeFormatted: string,
  confidence: number
): Promise<boolean> {
  const recipients: string[] = [];
  if (Array.isArray(recipientEmail)) {
    recipients.push(...recipientEmail.map(e => (typeof e === 'string' ? e.trim() : '')).filter(Boolean));
  } else if (recipientEmail && typeof recipientEmail === 'string') {
    recipients.push(...recipientEmail.split(',').map(e => e.trim()).filter(Boolean));
  }

  if (recipients.length === 0) {
    console.warn(`[EmailService] No recipient email configured for mall '${incident.mallId}'. Skipping timescale observation email.`);
    return false;
  }

  const activeTransporter = await getTransporter();
  const formattedType = incident.detectionType.toUpperCase();
  const locationDesc = incident.roomName
    ? `${incident.roomName} (Floor ${incident.floorId})`
    : `Floor ${incident.floorId}`;
  const confidencePct = Math.round(confidence * 100);
  const subject = `[EvacAI Ongoing Observation #${observationIndex}] ${formattedType} Still Present at ${mallName} (${timeFormatted})`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .card { background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; max-width: 600px; margin: 0 auto; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%); color: #ffffff; padding: 24px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
    .header p { margin: 6px 0 0; opacity: 0.9; font-size: 13px; }
    .body { padding: 24px; }
    .badge { display: inline-block; background-color: #fef2f2; color: #991b1b; font-weight: 700; padding: 4px 12px; border-radius: 9999px; font-size: 12px; margin-bottom: 16px; border: 1px solid #fecaca; }
    .table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
    .table td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; }
    .table td.label { font-weight: 600; color: #64748b; width: 38%; }
    .table td.value { font-weight: 500; color: #0f172a; }
    .footer { padding: 14px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>⏱️ Ongoing Hazard Observation Update</h1>
      <p>Continuous AI surveillance timespan report (15-minute observation cycle)</p>
    </div>
    <div class="body">
      <div class="badge">Observation #${observationIndex} &bull; Situation at ${timeFormatted}</div>
      <p style="font-size: 13px; color: #475569; margin: 0 0 14px; line-height: 1.5;">
        Continuous monitoring confirms that <strong>${formattedType}</strong> is still actively detected by <strong>${incident.cameraName || 'CCTV Camera'}</strong>. A fresh timescale snapshot has been recorded.
      </p>
      <table class="table">
        <tr>
          <td class="label">Shopping Mall</td>
          <td class="value">${mallName}</td>
        </tr>
        <tr>
          <td class="label">Hazard Status</td>
          <td class="value" style="color: #dc2626; font-weight: 700;">STILL PRESENT (${formattedType})</td>
        </tr>
        <tr>
          <td class="label">Camera & Location</td>
          <td class="value">${incident.cameraName || 'CCTV'} &bull; ${locationDesc}</td>
        </tr>
        <tr>
          <td class="label">Observation Time</td>
          <td class="value">${formatDateTime(observedAt)} (${timeFormatted})</td>
        </tr>
        <tr>
          <td class="label">Initial Detection</td>
          <td class="value">${formatDateTime(incident.detectedAt)}</td>
        </tr>
        <tr>
          <td class="label">Current Confidence</td>
          <td class="value">${confidencePct}%</td>
        </tr>
        <tr>
          <td class="label">Incident Reference</td>
          <td class="value" style="font-family: monospace;">${incident.incidentId}</td>
        </tr>
      </table>
      <p style="margin-top: 18px; font-size: 13px; color: #64748b; line-height: 1.5;">
        Check the Mall Situation Monitor and live surveillance feeds for continuous real-time spatial updates.
      </p>
    </div>
    <div class="footer">
      EvacAI Continuous Monitoring &bull; Automated 15-min Observation Dispatch
    </div>
  </div>
</body>
</html>
  `.trim();

  if (!activeTransporter) {
    console.info(
      `[EmailService] Note: SMTP is unconfigured. Simulated timescale observation email for incident '${incident.incidentId}' (#${observationIndex}) to '${recipients.join(', ')}'`
    );
    return false;
  }

  try {
    const toAddress = recipients.join(', ');
    const info = await activeTransporter.sendMail({
      from: env.smtp.from,
      to: toAddress,
      subject,
      html: htmlContent,
    });
    console.log(`[EmailService] ✉️ Timescale observation email #${observationIndex} dispatched for incident '${incident.incidentId}' to [${toAddress}]. MessageId: ${info.messageId}`);
    return true;
  } catch (error: any) {
    console.error(`[EmailService] Failed to send observation email for incident '${incident.incidentId}':`, error.message);
    return false;
  }
}
