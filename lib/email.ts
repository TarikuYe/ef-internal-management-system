// Bond submission notification email template
export function bondSubmissionEmailHtml(params: {
  submitterName: string
  submitterEmail: string
  projectName: string
  contractorName: string
  bondType: string
  expiryDate: string
  status: string
  amount?: string
}) {
  const { submitterName, submitterEmail, projectName, contractorName, bondType, expiryDate, status, amount } = params
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#eef1f6;font-family:Inter,Arial,sans-serif;color:#2b3247;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dfe4ec;">
            <tr>
              <td style="background:#2b3247;padding:28px 36px;">
                <div style="font-family:Manrope,Arial,sans-serif;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">
                  EF <span style="color:#e0a341;">Architect &amp; Engineering</span>
                </div>
                <div style="font-size:13px;color:#aab3c5;margin-top:4px;">Project Bond Notification</div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px;">
                <h1 style="font-family:Manrope,Arial,sans-serif;font-size:22px;margin:0 0 12px;color:#2b3247;">New Project Bond Logged</h1>
                <p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:#4a5163;">
                  A new project bond has been logged in the system with the following details:
                </p>
                <table style="width:100%;margin:16px 0;border-collapse:collapse;">
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;width:40%;">Submitted by:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${submitterName} (${submitterEmail})</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Project:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${projectName}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Contractor:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${contractorName}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Bond Type:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${bondType}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Expiry Date:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${expiryDate}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Status:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${status}</td></tr>
                  ${amount ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Amount:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${amount} ETB</td></tr>` : ''}
                </table>
                <p style="font-size:13px;line-height:1.6;margin:16px 0 0;color:#8a91a3;">
                  This notification was sent automatically from the EF Project Management System.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 36px;background:#f6f8fb;border-top:1px solid #dfe4ec;font-size:12px;color:#8a91a3;">
                EF Architect &amp; Engineering &middot; This is an automated message.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

// EOT submission notification email template
export function eotSubmissionEmailHtml(params: {
  submitterName: string
  submitterEmail: string
  projectName: string
  contractorName: string
  claimNumber: string
  daysApproved: string
  revisedDate: string
  status: string
  reason: string
}) {
  const { submitterName, submitterEmail, projectName, contractorName, claimNumber, daysApproved, revisedDate, status, reason } = params
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#eef1f6;font-family:Inter,Arial,sans-serif;color:#2b3247;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dfe4ec;">
            <tr>
              <td style="background:#2b3247;padding:28px 36px;">
                <div style="font-family:Manrope,Arial,sans-serif;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">
                  EF <span style="color:#e0a341;">Architect &amp; Engineering</span>
                </div>
                <div style="font-size:13px;color:#aab3c5;margin-top:4px;">EOT Extension Notification</div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px;">
                <h1 style="font-family:Manrope,Arial,sans-serif;font-size:22px;margin:0 0 12px;color:#2b3247;">New EOT Extension Logged</h1>
                <p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:#4a5163;">
                  A new Extension of Time (EOT) has been logged in the system with the following details:
                </p>
                <table style="width:100%;margin:16px 0;border-collapse:collapse;">
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;width:40%;">Submitted by:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${submitterName} (${submitterEmail})</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Project:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${projectName}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Contractor:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${contractorName}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Claim Number:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${claimNumber}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Days Approved:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${daysApproved}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Revised Completion:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${revisedDate}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">Status:</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${status}</td></tr>
                </table>
                <p style="font-size:15px;line-height:1.6;margin:16px 0;color:#4a5163;font-weight:600;">Reason for Extension:</p>
                <p style="font-size:14px;line-height:1.5;margin:0 0 16px;color:#4a5163;background:#f6f8fb;padding:12px;border-radius:6px;">${reason}</p>
                <p style="font-size:13px;line-height:1.6;margin:16px 0 0;color:#8a91a3;">
                  This notification was sent automatically from the EF Project Management System.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 36px;background:#f6f8fb;border-top:1px solid #dfe4ec;font-size:12px;color:#8a91a3;">
                EF Architect &amp; Engineering &middot; This is an automated message.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export function reminderEmailHtml(params: {
  periodLabel: string
  portalUrl: string
  dueDateLabel: string
  employeeName?: string
}) {
  const { periodLabel, portalUrl, dueDateLabel, employeeName } = params
  const greeting = employeeName ? `Hello ${employeeName},` : 'Hello,'
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#eef1f6;font-family:Inter,Arial,sans-serif;color:#2b3247;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dfe4ec;">
            <tr>
              <td style="background:#2b3247;padding:28px 36px;">
                <div style="font-family:Manrope,Arial,sans-serif;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">
                  EF <span style="color:#e0a341;">Architect &amp; Engineering</span>
                </div>
                <div style="font-size:13px;color:#aab3c5;margin-top:4px;">Internal Management Portal</div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px;">
                <h1 style="font-family:Manrope,Arial,sans-serif;font-size:22px;margin:0 0 12px;color:#2b3247;">Report submission reminder</h1>
                <p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:#4a5163;font-weight:600;">
                  ${greeting}
                </p>
                <p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:#4a5163;">
                  This is a reminder to submit your project report for the
                  <strong>${periodLabel}</strong> reporting period. Submissions are due by
                  <strong>${dueDateLabel}</strong>.
                </p>
                <p style="font-size:15px;line-height:1.6;margin:0 0 28px;color:#4a5163;">
                  Please upload your report through the secure portal below. Include your name,
                  email, project code, and the correct reporting period.
                </p>
                <a href="${portalUrl}" style="display:inline-block;background:#e0a341;color:#2b1f08;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:8px;">
                  Submit your report
                </a>
                <p style="font-size:13px;line-height:1.6;margin:28px 0 0;color:#8a91a3;">
                  If you have already submitted for this period, no action is needed.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 36px;background:#f6f8fb;border-top:1px solid #dfe4ec;font-size:12px;color:#8a91a3;">
                EF Architect &amp; Engineering &middot; This is an automated message.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export function bondAlertEmailHtml(params: {
  projectName: string
  contractorName: string
  employerName: string
  bondType: string
  expiryDate: string
  amount?: string
  daysOverdue: number
  message: string
  recipientName?: string
}) {
  const { projectName, contractorName, employerName, bondType, expiryDate, amount, daysOverdue, message, recipientName } = params
  const greeting = recipientName || contractorName
  const formattedMessage = message.replace(/\n/g, '<br />')
  const formattedExpiry = new Date(expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  return `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Expired Bond Alert — ${projectName}</title></head>
<body style="margin:0;padding:0;background-color:#F1F5F9;font-family:'Segoe UI',Inter,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1F5F9;padding:36px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr>
          <td style="background:#DC2626;padding:30px 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <div style="font-size:11px;font-weight:700;color:#FCA5A5;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">EF Architects &amp; Engineers Consulting — Urgent Alert</div>
                <div style="font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-0.4px;line-height:1.25;">Guarantee Bond Expired</div>
                <div style="margin-top:10px;font-size:13px;color:#FECACA;">Immediate action is required on the bond detailed below.</div>
              </td>
              <td align="right" valign="top" style="padding-left:16px;">
                <div style="background:#FEE2E2;color:#991B1B;border:1px solid #FCA5A5;border-radius:20px;padding:6px 14px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;white-space:nowrap;">OVERDUE ${daysOverdue} DAY${daysOverdue !== 1 ? 'S' : ''}</div>
              </td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px 0;">
            <p style="margin:0 0 20px;font-size:16px;font-weight:600;color:#1E3A8A;">Dear ${greeting},</p>
            <div style="background:#F8FAFC;border-left:4px solid #DC2626;padding:20px;border-radius:0 8px 8px 0;">
              <span style="font-size:11px;font-weight:800;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:6px;">Message from Contract Administration</span>
              <p style="font-size:15px;line-height:1.6;margin:0;color:#334155;font-style:italic;">${formattedMessage}</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FEE2E2;border:1px solid #FCA5A5;border-radius:12px;">
              <tr><td style="padding:20px 24px;">
                <div style="font-size:12px;font-weight:700;color:#991B1B;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Overdue Status</div>
                <div style="font-size:28px;font-weight:800;color:#991B1B;letter-spacing:-0.5px;">${daysOverdue} Day${daysOverdue !== 1 ? 's' : ''} Overdue</div>
                <div style="font-size:13px;color:#991B1B;margin-top:4px;opacity:0.85;">Bond expired on <strong>${formattedExpiry}</strong></div>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 40px 0;">
            <div style="font-size:13px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.8px;border-bottom:2px solid #E2E8F0;padding-bottom:8px;">Bond Information</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse;">
              <tr><td style="padding:13px 0;color:#64748B;font-weight:500;width:42%;border-bottom:1px solid #F1F5F9;">Project Name</td><td style="padding:13px 0;color:#0F172A;font-weight:600;border-bottom:1px solid #F1F5F9;">${projectName}</td></tr>
              <tr><td style="padding:13px 0;color:#64748B;font-weight:500;border-bottom:1px solid #F1F5F9;">Contractor</td><td style="padding:13px 0;color:#0F172A;font-weight:600;border-bottom:1px solid #F1F5F9;">${contractorName}</td></tr>
              <tr><td style="padding:13px 0;color:#64748B;font-weight:500;border-bottom:1px solid #F1F5F9;">Employer / Client</td><td style="padding:13px 0;color:#0F172A;font-weight:600;border-bottom:1px solid #F1F5F9;">${employerName}</td></tr>
              <tr><td style="padding:13px 0;color:#64748B;font-weight:500;border-bottom:1px solid #F1F5F9;">Bond Type</td><td style="padding:13px 0;color:#0F172A;font-weight:600;border-bottom:1px solid #F1F5F9;">${bondType}</td></tr>
              <tr><td style="padding:13px 0;color:#64748B;font-weight:500;border-bottom:1px solid #F1F5F9;">Expiry Date</td><td style="padding:13px 0;font-weight:700;color:#991B1B;border-bottom:1px solid #F1F5F9;">${formattedExpiry}</td></tr>
              <tr><td style="padding:13px 0;color:#64748B;font-weight:500;border-bottom:1px solid #F1F5F9;">Days Overdue</td><td style="padding:13px 0;font-weight:700;color:#991B1B;border-bottom:1px solid #F1F5F9;">${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}</td></tr>
              ${amount ? `<tr><td style="padding:13px 0;color:#64748B;font-weight:500;border-bottom:1px solid #F1F5F9;">Bond Amount</td><td style="padding:13px 0;color:#0F172A;font-weight:600;border-bottom:1px solid #F1F5F9;">${amount}</td></tr>` : ''}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 40px 0;">
            <div style="background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0;padding:16px 20px;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#64748B;"><strong>Action Required:</strong> Failure to address this expired bond may result in a contractual default. Please execute the necessary supervision or guarantee actions immediately. Contact the Contract Administration Department if you require assistance.</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;border-top:1px solid #E2E8F0;margin-top:32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <div style="font-size:13px;font-weight:700;color:#1E3A8A;">EF Architects and Engineering Consulting PLC</div>
                <div style="font-size:12px;color:#64748B;margin-top:4px;line-height:1.6;">Contract Administration Department &middot; Contract Administration Manager's Office<br />Addis Ababa, Ethiopia</div>
              </td>
              <td align="right" valign="top"><div style="font-size:11px;color:#94A3B8;text-align:right;">Authenticated notification<br />Do not reply to this email</div></td>
            </tr></table>
            <div style="margin-top:16px;padding-top:16px;border-top:1px solid #F1F5F9;font-size:11px;color:#94A3B8;line-height:1.5;">This message was generated by the EF Contract Management System. It is confidential and intended solely for the named recipient. If you received this in error, please notify the sender and delete it immediately.</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function eotAlertEmailHtml(params: {
  projectName: string
  contractorName: string
  revisedDate: string
  daysApproved: string
  claimNumber: string
  daysRemaining: number
  message: string
  recipientName?: string
}) {
  const { projectName, contractorName, revisedDate, daysApproved, claimNumber, daysRemaining, message, recipientName } = params
  const greeting = recipientName || contractorName
  const formattedMessage = message.replace(/\n/g, '<br />')
  const formattedDeadline = new Date(revisedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const urgencyBg = daysRemaining <= 7 ? '#FEE2E2' : daysRemaining <= 15 ? '#FEF3C7' : '#EFF6FF'
  const urgencyText = daysRemaining <= 7 ? '#991B1B' : daysRemaining <= 15 ? '#92400E' : '#1E40AF'
  const urgencyBorder = daysRemaining <= 7 ? '#FCA5A5' : daysRemaining <= 15 ? '#FCD34D' : '#93C5FD'
  const urgencyLabel = daysRemaining <= 7 ? 'CRITICAL' : daysRemaining <= 15 ? 'HIGH PRIORITY' : 'ADVANCE NOTICE'
  const headerBg = daysRemaining <= 7 ? '#DC2626' : daysRemaining <= 15 ? '#D97706' : '#475569'
  return `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>EOT Timeline Alert — ${projectName}</title></head>
<body style="margin:0;padding:0;background-color:#F1F5F9;font-family:'Segoe UI',Inter,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1F5F9;padding:36px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr>
          <td style="background:${headerBg};padding:30px 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <div style="font-size:11px;font-weight:700;color:#CBD5E1;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">EF Architects &amp; Engineers Consulting — Timeline Advisory</div>
                <div style="font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-0.4px;line-height:1.25;">Contract Timeline Expiry Alert</div>
                <div style="margin-top:10px;font-size:13px;color:#CBD5E1;">An approved EOT window is approaching its revised completion deadline.</div>
              </td>
              <td align="right" valign="top" style="padding-left:16px;">
                <div style="background:${urgencyBg};color:${urgencyText};border:1px solid ${urgencyBorder};border-radius:20px;padding:6px 14px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;white-space:nowrap;">${urgencyLabel}</div>
              </td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px 0;">
            <p style="margin:0 0 20px;font-size:16px;font-weight:600;color:#334155;">Dear ${greeting},</p>
            <div style="background:#F8FAFC;border-left:4px solid ${headerBg};padding:20px;border-radius:0 8px 8px 0;">
              <span style="font-size:11px;font-weight:800;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:6px;">Message from Contract Administration</span>
              <p style="font-size:15px;line-height:1.6;margin:0;color:#334155;font-style:italic;">${formattedMessage}</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${urgencyBg};border:1px solid ${urgencyBorder};border-radius:12px;">
              <tr><td style="padding:20px 24px;">
                <div style="font-size:12px;font-weight:700;color:${urgencyText};text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Revised Deadline Closing In</div>
                <div style="font-size:28px;font-weight:800;color:${urgencyText};letter-spacing:-0.5px;">${daysRemaining} Day${daysRemaining !== 1 ? 's' : ''} Remaining</div>
                <div style="font-size:13px;color:${urgencyText};margin-top:4px;opacity:0.85;">EOT revised completion target: <strong>${formattedDeadline}</strong></div>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 40px 0;">
            <div style="font-size:13px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.8px;border-bottom:2px solid #E2E8F0;padding-bottom:8px;">EOT Tracking Information</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse;">
              <tr><td style="padding:13px 0;color:#64748B;font-weight:500;width:42%;border-bottom:1px solid #F1F5F9;">Project Name</td><td style="padding:13px 0;color:#0F172A;font-weight:600;border-bottom:1px solid #F1F5F9;">${projectName}</td></tr>
              <tr><td style="padding:13px 0;color:#64748B;font-weight:500;border-bottom:1px solid #F1F5F9;">Contractor</td><td style="padding:13px 0;color:#0F172A;font-weight:600;border-bottom:1px solid #F1F5F9;">${contractorName}</td></tr>
              <tr><td style="padding:13px 0;color:#64748B;font-weight:500;border-bottom:1px solid #F1F5F9;">EOT Claim No.</td><td style="padding:13px 0;color:#0F172A;font-weight:600;border-bottom:1px solid #F1F5F9;">#${claimNumber}</td></tr>
              <tr><td style="padding:13px 0;color:#64748B;font-weight:500;border-bottom:1px solid #F1F5F9;">Extension Granted</td><td style="padding:13px 0;color:#0F172A;font-weight:600;border-bottom:1px solid #F1F5F9;">${daysApproved} calendar days</td></tr>
              <tr><td style="padding:13px 0;color:#64748B;font-weight:500;border-bottom:1px solid #F1F5F9;">Revised Deadline</td><td style="padding:13px 0;font-weight:700;color:${urgencyText};border-bottom:1px solid #F1F5F9;">${formattedDeadline}</td></tr>
              <tr><td style="padding:13px 0;color:#64748B;font-weight:500;border-bottom:1px solid #F1F5F9;">Days Remaining</td><td style="padding:13px 0;font-weight:700;color:${urgencyText};border-bottom:1px solid #F1F5F9;">${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 40px 0;">
            <div style="background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0;padding:16px 20px;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#64748B;"><strong>Action Required:</strong> Please verify site execution progress against the approved EOT programme. If the contractor is unlikely to achieve substantial completion by the revised deadline, initiate the appropriate contractual response in accordance with the contract conditions.</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;border-top:1px solid #E2E8F0;margin-top:32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <div style="font-size:13px;font-weight:700;color:#475569;">EF Architects and Engineering Consulting PLC</div>
                <div style="font-size:12px;color:#64748B;margin-top:4px;line-height:1.6;">Contract Administration Department &middot; Contract Administration Manager's Office<br />Addis Ababa, Ethiopia</div>
              </td>
              <td align="right" valign="top"><div style="font-size:11px;color:#94A3B8;text-align:right;">Confidential internal<br />Do not reply to this email</div></td>
            </tr></table>
            <div style="margin-top:16px;padding-top:16px;border-top:1px solid #F1F5F9;font-size:11px;color:#94A3B8;line-height:1.5;">This message was generated by the EF Contract Management System. It is intended solely for authorised recipients. Do not forward or distribute outside the organisation without approval.</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
