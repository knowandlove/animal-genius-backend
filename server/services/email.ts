import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email using the configured email service
 * 
 * This is a placeholder implementation. In production, you should:
 * 1. Use Supabase Edge Functions with an email provider (SendGrid, Resend, etc.)
 * 2. Or integrate directly with an email service provider
 * 3. Or use Supabase's built-in email functionality
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    // TODO: Implement actual email sending
    // Option 1: Use Supabase Edge Function
    // const { data, error } = await supabase.functions.invoke('send-email', {
    //   body: options
    // });

    // Option 2: Use a third-party service like SendGrid or Resend
    // const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     personalizations: [{ to: [{ email: options.to }] }],
    //     from: { email: process.env.FROM_EMAIL || 'noreply@animalgenius.com' },
    //     subject: options.subject,
    //     content: [
    //       { type: 'text/html', value: options.html },
    //       ...(options.text ? [{ type: 'text/plain', value: options.text }] : [])
    //     ]
    //   })
    // });

    // For development, just log the email
    console.log('📧 Email would be sent:', {
      to: options.to,
      subject: options.subject,
      preview: options.text?.substring(0, 100) || options.html.substring(0, 100)
    });

    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

/**
 * Send a collaborator invitation email
 */
export async function sendCollaboratorInvitation(
  recipientEmail: string,
  inviterName: string,
  className: string,
  token: string,
  message?: string
): Promise<boolean> {
  const acceptUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invitations/accept/${token}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Collaboration Invitation - Animal Genius</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <tr>
                <td style="padding: 40px 30px;">
                  <h1 style="color: #333; margin: 0 0 20px 0; font-size: 24px;">You've been invited to collaborate!</h1>
                  
                  <p style="color: #555; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
                    ${inviterName} has invited you to collaborate on the class "<strong>${className}</strong>" in Animal Genius.
                  </p>
                  
                  ${message ? `
                  <div style="background-color: #f9f9f9; border-left: 4px solid #4CAF50; padding: 15px; margin: 20px 0;">
                    <p style="color: #333; font-size: 14px; margin: 0 0 5px 0;"><strong>Message from ${inviterName}:</strong></p>
                    <p style="color: #555; font-size: 14px; margin: 0;">${message}</p>
                  </div>
                  ` : ''}
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${acceptUrl}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 14px 30px; text-decoration: none; border-radius: 4px; font-size: 16px; font-weight: bold;">
                      Accept Invitation
                    </a>
                  </div>
                  
                  <p style="color: #888; font-size: 14px; margin: 20px 0 0 0;">
                    If you're unable to click the button, copy and paste this link into your browser:
                  </p>
                  <p style="color: #888; font-size: 14px; margin: 5px 0 0 0; word-break: break-all;">
                    <a href="${acceptUrl}" style="color: #4CAF50;">${acceptUrl}</a>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background-color: #f9f9f9; padding: 20px 30px; border-top: 1px solid #eee;">
                  <p style="color: #888; font-size: 12px; margin: 0; text-align: center;">
                    This invitation was sent from Animal Genius. If you didn't expect this email, you can safely ignore it.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `
You've been invited to collaborate!

${inviterName} has invited you to collaborate on the class "${className}" in Animal Genius.

${message ? `Message from ${inviterName}:\n${message}\n\n` : ''}

Accept the invitation by clicking this link:
${acceptUrl}

If you didn't expect this invitation, you can safely ignore this email.
  `.trim();

  return sendEmail({
    to: recipientEmail,
    subject: `Invitation to collaborate on "${className}"`,
    html,
    text
  });
}