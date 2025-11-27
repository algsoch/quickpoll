"""
Email Service for QuickPoll
Supports multiple email providers:
- SMTP (Gmail, Outlook, custom SMTP servers)
- Resend (recommended for production)
- Development mode (prints to console)
"""

import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import httpx
from .config import settings


class EmailService:
    """Email service with support for SMTP and Resend API"""
    
    def __init__(self):
        self.smtp_host = getattr(settings, 'smtp_host', None)
        self.smtp_port = getattr(settings, 'smtp_port', 587)
        self.smtp_user = getattr(settings, 'smtp_user', None)
        self.smtp_password = getattr(settings, 'smtp_password', None)
        self.smtp_from_email = getattr(settings, 'smtp_from_email', None)
        self.smtp_from_name = getattr(settings, 'smtp_from_name', 'QuickPoll')
        self.resend_api_key = getattr(settings, 'resend_api_key', None)
        
    @property
    def is_configured(self) -> bool:
        """Check if any email provider is configured"""
        return self._is_smtp_configured or self._is_resend_configured
    
    @property
    def _is_smtp_configured(self) -> bool:
        """Check if SMTP is configured"""
        return all([self.smtp_host, self.smtp_user, self.smtp_password, self.smtp_from_email])
    
    @property
    def _is_resend_configured(self) -> bool:
        """Check if Resend API is configured"""
        return bool(self.resend_api_key)
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> dict:
        """
        Send an email using the configured provider.
        Returns dict with 'success' bool and 'message' or 'error' string.
        """
        if not self.is_configured:
            print(f"[DEV MODE] Email would be sent to: {to_email}")
            print(f"[DEV MODE] Subject: {subject}")
            print(f"[DEV MODE] Content: {html_content[:500]}...")
            return {
                "success": False,
                "dev_mode": True,
                "message": "Email not configured - development mode"
            }
        
        # Prefer Resend if configured (better deliverability)
        if self._is_resend_configured:
            return await self._send_via_resend(to_email, subject, html_content, text_content)
        
        # Fall back to SMTP
        return await self._send_via_smtp(to_email, subject, html_content, text_content)
    
    async def _send_via_resend(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> dict:
        """Send email via Resend API"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {self.resend_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "from": f"{self.smtp_from_name} <{self.smtp_from_email or 'onboarding@resend.dev'}>",
                        "to": [to_email],
                        "subject": subject,
                        "html": html_content,
                        "text": text_content or html_content
                    },
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    return {"success": True, "message": "Email sent successfully via Resend"}
                else:
                    error_data = response.json()
                    return {"success": False, "error": error_data.get("message", "Unknown error")}
                    
        except Exception as e:
            print(f"Resend error: {e}")
            return {"success": False, "error": str(e)}
    
    async def _send_via_smtp(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> dict:
        """Send email via SMTP"""
        try:
            # Create message
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = f"{self.smtp_from_name} <{self.smtp_from_email}>"
            message["To"] = to_email
            
            # Add text part
            if text_content:
                part1 = MIMEText(text_content, "plain")
                message.attach(part1)
            
            # Add HTML part
            part2 = MIMEText(html_content, "html")
            message.attach(part2)
            
            # Connect and send
            context = ssl.create_default_context()
            
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls(context=context)
                server.login(self.smtp_user, self.smtp_password)
                server.sendmail(self.smtp_from_email, to_email, message.as_string())
            
            return {"success": True, "message": "Email sent successfully via SMTP"}
            
        except Exception as e:
            print(f"SMTP error: {e}")
            return {"success": False, "error": str(e)}


# Global email service instance
email_service = EmailService()


def get_password_reset_email_html(reset_url: str, user_name: str = "User") -> str:
    """Generate beautiful HTML email for password reset"""
    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #6366F1, #4F46E5); border-radius: 16px 16px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">📊 QuickPoll</h1>
                            <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Password Reset Request</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px; color: #1e293b; font-size: 18px;">
                                Hi {user_name},
                            </p>
                            <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.6;">
                                We received a request to reset your password for your QuickPoll account. 
                                Click the button below to create a new password:
                            </p>
                            
                            <!-- Button -->
                            <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="{reset_url}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #6366F1, #4F46E5); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);">
                                            🔐 Reset Password
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 0 0 15px; color: #475569; font-size: 14px; line-height: 1.6;">
                                <strong>⏰ This link will expire in 1 hour</strong> for security reasons.
                            </p>
                            
                            <p style="margin: 0 0 15px; color: #64748b; font-size: 14px; line-height: 1.6;">
                                If you didn't request this password reset, you can safely ignore this email. 
                                Your password will remain unchanged.
                            </p>
                            
                            <!-- Security Tips -->
                            <div style="margin: 30px 0; padding: 20px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0;">
                                <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600;">🛡️ Security Tip:</p>
                                <p style="margin: 8px 0 0; color: #b45309; font-size: 13px;">
                                    Never share your password with anyone. QuickPoll will never ask for your password via email.
                                </p>
                            </div>
                            
                            <p style="margin: 0; color: #64748b; font-size: 13px;">
                                If the button doesn't work, copy and paste this link into your browser:
                            </p>
                            <p style="margin: 10px 0 0; padding: 15px; background-color: #f1f5f9; border-radius: 8px; word-break: break-all; font-size: 12px; color: #475569;">
                                {reset_url}
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0 0 10px; color: #64748b; font-size: 13px;">
                                © 2025 QuickPoll. All rights reserved.
                            </p>
                            <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                                Create polls, gather opinions, make decisions.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""


def get_password_reset_email_text(reset_url: str, user_name: str = "User") -> str:
    """Generate plain text email for password reset"""
    return f"""
Hi {user_name},

We received a request to reset your password for your QuickPoll account.

To reset your password, click this link (expires in 1 hour):
{reset_url}

If you didn't request this password reset, you can safely ignore this email.

Security Tip: Never share your password with anyone. QuickPoll will never ask for your password via email.

---
QuickPoll - Create polls, gather opinions, make decisions.
"""
