import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOTPEmail(email: string, name: string, otp: string) {
  return resend.emails.send({
    from: `sczor <${process.env.RESEND_FROM_EMAIL ?? "noreply@sczor.com"}>`,
    to: email,
    subject: "Verify your sczor account - OTP inside",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #ffffff;">
        <div style="background: #111111; padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 2px;">SCZOR</h1>
          <p style="color: #aaaaaa; margin: 8px 0 0; font-size: 12px; letter-spacing: 1px;">Less Admin. More Glam.</p>
        </div>
        <div style="padding: 32px 24px; color: #333333;">
          <p style="font-size: 16px;">Hi ${name},</p>
          <p style="font-size: 14px; line-height: 1.6;">
            Thanks for signing up for sczor! Please use the OTP below to verify your email address.
            This code will expire in 10 minutes.
          </p>
          <div style="margin: 24px 0; text-align: center;">
            <span style="display: inline-block; background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px 32px; font-size: 28px; font-weight: bold; letter-spacing: 8px; color: #111111;">
              ${otp}
            </span>
          </div>
          <p style="font-size: 13px; color: #777777; line-height: 1.6;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
        <div style="background: #f9f9f9; padding: 16px 24px; text-align: center; border-top: 1px solid #eeeeee;">
          <p style="font-size: 12px; color: #999999; margin: 0;">
            Need help? Contact us at connect@droletechnologies.com
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, name: string, otp: string) {
  return resend.emails.send({
    from: `sczor <${process.env.RESEND_FROM_EMAIL ?? "noreply@sczor.com"}>`,
    to: email,
    subject: "Reset your sczor password - OTP inside",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #ffffff;">
        <div style="background: #111111; padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 2px;">SCZOR</h1>
          <p style="color: #aaaaaa; margin: 8px 0 0; font-size: 12px; letter-spacing: 1px;">Less Admin. More Glam.</p>
        </div>
        <div style="padding: 32px 24px; color: #333333;">
          <p style="font-size: 16px;">Hi ${name},</p>
          <p style="font-size: 14px; line-height: 1.6;">
            We received a request to reset your sczor password. Use the OTP below to continue.
            This code will expire in 10 minutes.
          </p>
          <div style="margin: 24px 0; text-align: center;">
            <span style="display: inline-block; background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px 32px; font-size: 28px; font-weight: bold; letter-spacing: 8px; color: #111111;">
              ${otp}
            </span>
          </div>
          <p style="font-size: 13px; color: #777777; line-height: 1.6;">
            If you didn't request a password reset, you can safely ignore this email - your password will not change.
          </p>
        </div>
        <div style="background: #f9f9f9; padding: 16px 24px; text-align: center; border-top: 1px solid #eeeeee;">
          <p style="font-size: 12px; color: #999999; margin: 0;">
            Need help? Contact us at connect@droletechnologies.com
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendWelcomeEmail(
  email: string,
  name: string,
) {
  return resend.emails.send({
    from: `sczor <${process.env.RESEND_FROM_EMAIL ?? "noreply@sczor.com"}>`,
    to: email,
    subject: `Welcome to sczor, ${name}! Your salon is ready`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #ffffff;">
        <div style="background: #111111; padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 2px;">SCZOR</h1>
          <p style="color: #aaaaaa; margin: 8px 0 0; font-size: 12px; letter-spacing: 1px;">Less Admin. More Glam.</p>
        </div>
        <div style="padding: 32px 24px; color: #333333;">
          <p style="font-size: 16px;">Hi ${name},</p>
          <p style="font-size: 14px; line-height: 1.6;">
            Welcome to sczor! Your salon workspace is all set up and ready to go.
          </p>
          <p style="font-size: 14px; font-weight: bold; margin: 24px 0 12px; color: #111111;">Quick Start Guide:</p>
          <ol style="font-size: 14px; line-height: 1.8; color: #333333; margin: 0; padding-left: 20px;">
            <li><strong>Add Your Services</strong> – Set up your salon's services with pricing and duration</li>
            <li><strong>Add Your Staff</strong> – Add team members and set their availability</li>
            <li><strong>Book Your First Appointment</strong> – Start managing appointments and customers</li>
          </ol>
          <div style="margin: 24px 0; text-align: center;">
            <a href="https://sczor.com/login" style="display: inline-block; background: #1E40AF; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: bold; font-size: 14px;">
              Log in to your dashboard
            </a>
          </div>
          <p style="font-size: 13px; color: #777777; line-height: 1.6;">
            Need help? Our support team is here for you at <a href="mailto:connect@droletechnologies.com" style="color: #1E40AF; text-decoration: none;">connect@droletechnologies.com</a>
          </p>
        </div>
        <div style="background: #f9f9f9; padding: 16px 24px; text-align: center; border-top: 1px solid #eeeeee;">
          <p style="font-size: 12px; color: #999999; margin: 0;">
            © 2024 sczor. All rights reserved.
          </p>
        </div>
      </div>
    `,
  });
}
