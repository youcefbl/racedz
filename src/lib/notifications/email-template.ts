type RaceDzEmailAction = {
  label: string;
  href: string;
};

type RaceDzEmailMeta = {
  label: string;
  value: string;
};

type RaceDzEmailTemplateInput = {
  preheader?: string;
  title: string;
  body: string;
  action?: RaceDzEmailAction;
  meta?: RaceDzEmailMeta[];
};

function getAppUrl() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    "https://zidrun.com";
  return raw.replace(/\/+$/, "");
}

export function renderRaceDzEmailHtml({ preheader, title, body, action, meta = [] }: RaceDzEmailTemplateInput) {
  const appUrl = getAppUrl();
  const logoUrl = `${appUrl}/icon-192.png`;
  const year = new Date().getFullYear();
  const bodyHtml = escapeHtml(body).replaceAll("\n", "<br />");

  const metaHtml = meta.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px;border:1px solid #e5e7eb;border-radius:12px;border-collapse:separate;overflow:hidden">
        ${meta
          .map(
            (item, index) => `
              <tr>
                <td dir="auto" style="padding:12px 16px;${index < meta.length - 1 ? "border-bottom:1px solid #f3f4f6;" : ""}color:#6b7280;font-size:13px">${escapeHtml(item.label)}</td>
                <td dir="auto" align="right" style="padding:12px 16px;${index < meta.length - 1 ? "border-bottom:1px solid #f3f4f6;" : ""}color:#111827;font-size:13px;font-weight:700">${escapeHtml(item.value)}</td>
              </tr>`
          )
          .join("")}
      </table>`
    : "";

  // Bulletproof button: padding on the <td> (with mso-padding-alt for Outlook's
  // Word engine, which drops padding on the <a>) and a solid bgcolor so the pill
  // renders the same everywhere. Label-agnostic (no fixed VML width to truncate).
  const actionHtml = action
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px">
        <tr>
          <td bgcolor="#F47A20" style="border-radius:10px;mso-padding-alt:14px 28px">
            <a href="${escapeHtml(action.href)}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;line-height:1.2;border-radius:10px">${escapeHtml(action.label)}</a>
          </td>
        </tr>
      </table>
      <p style="margin:16px 0 0;color:#6b7280;font-size:12px;line-height:1.6">Button not working? Copy and paste this link:<br /><a href="${escapeHtml(action.href)}" style="color:#15803D;word-break:break-all">${escapeHtml(action.href)}</a></p>`
    : "";

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <title>${escapeHtml(title)}</title>
        <!--[if mso]><style>* { font-family: Arial, sans-serif !important; }</style><![endif]-->
        <style>
          :root { color-scheme: light dark; supported-color-schemes: light dark; }
          body { margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
          a { text-decoration:none; }
          @media (max-width:600px) {
            .rz-pad { padding:24px 20px !important; }
          }
          @media (prefers-color-scheme: dark) {
            .rz-bg { background:#0b1220 !important; }
            .rz-footer, .rz-footer div { color:#9ca3af !important; }
          }
        </style>
      </head>
      <body class="rz-bg" style="margin:0;background:#f3f4f6;padding:28px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827">
        ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}${"&nbsp;&zwnj;".repeat(40)}</div>` : ""}
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse">
          <tr>
            <td align="center">
              <!--[if mso]><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;border-collapse:collapse">

                <!-- Brand header -->
                <tr>
                  <td align="left" style="padding:4px 4px 20px">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="vertical-align:middle">
                          <img src="${logoUrl}" width="40" height="40" alt="ZidRun" style="display:block;border-radius:10px" />
                        </td>
                        <td style="vertical-align:middle;padding-left:10px">
                          <span style="font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.5px">Zid<span style="color:#15803D">Run</span></span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Card -->
                <tr>
                  <td style="background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden">
                    <div style="height:5px;background:#15803D;background:linear-gradient(90deg,#15803D 0%,#F47A20 100%);font-size:0;line-height:0">&nbsp;</div>
                    <div class="rz-pad" style="padding:32px 28px">
                      <h1 dir="auto" style="margin:0;color:#0f172a;font-size:24px;line-height:1.3;font-weight:700">${escapeHtml(title)}</h1>
                      <p dir="auto" style="margin:16px 0 0;color:#374151;font-size:15px;line-height:1.7">${bodyHtml}</p>
                      ${metaHtml}
                      ${actionHtml}
                    </div>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td class="rz-footer" style="padding:22px 8px 0;color:#6b7280;font-size:12px;line-height:1.7">
                    <div style="font-weight:700;color:#4b5563">ZidRun — Discover races, register, and train with an AI coach across Algeria.</div>
                    <div style="margin-top:6px;color:#6b7280">You received this email because you have a ZidRun account or race registration. Manage notifications anytime from your account settings.</div>
                    <div style="margin-top:12px;color:#6b7280">© ${year} ZidRun · <a href="${escapeHtml(appUrl)}" style="color:#15803D;text-decoration:none">zidrun.com</a></div>
                  </td>
                </tr>

              </table>
              <!--[if mso]></td></tr></table><![endif]-->
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

export function renderRaceDzEmailText({ title, body, action, meta = [] }: RaceDzEmailTemplateInput) {
  const appUrl = getAppUrl();
  return [
    "ZidRun — Discover races, register, and train with an AI coach across Algeria.",
    "",
    title,
    body,
    ...meta.map((item) => `${item.label}: ${item.value}`),
    action ? `${action.label}: ${action.href}` : null,
    "",
    `© ${new Date().getFullYear()} ZidRun · ${appUrl}`
  ]
    .filter((line) => line !== null)
    .join("\n\n");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
