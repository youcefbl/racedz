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
    "https://racedz.dz";
  return raw.replace(/\/+$/, "");
}

export function renderRaceDzEmailHtml({ preheader, title, body, action, meta = [] }: RaceDzEmailTemplateInput) {
  const appUrl = getAppUrl();
  const logoUrl = `${appUrl}/icon-192.png`;
  const year = new Date().getFullYear();
  const bodyHtml = escapeHtml(body).replaceAll("\n", "<br />");

  const metaHtml = meta.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border:1px solid #e5e7eb;border-radius:12px;border-collapse:separate;overflow:hidden">
        ${meta
          .map(
            (item, index) => `
              <tr>
                <td style="padding:12px 16px;${index < meta.length - 1 ? "border-bottom:1px solid #f3f4f6;" : ""}color:#6b7280;font-size:13px">${escapeHtml(item.label)}</td>
                <td align="right" style="padding:12px 16px;${index < meta.length - 1 ? "border-bottom:1px solid #f3f4f6;" : ""}color:#111827;font-size:13px;font-weight:700">${escapeHtml(item.value)}</td>
              </tr>`
          )
          .join("")}
      </table>`
    : "";

  const actionHtml = action
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:28px">
        <tr>
          <td style="border-radius:10px;background:#f97316">
            <a href="${escapeHtml(action.href)}" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-weight:800;font-size:15px;border-radius:10px">${escapeHtml(action.label)}</a>
          </td>
        </tr>
      </table>
      <p style="margin:14px 0 0;color:#9ca3af;font-size:12px;line-height:1.6">Button not working? Copy and paste this link:<br /><a href="${escapeHtml(action.href)}" style="color:#0f766e;word-break:break-all">${escapeHtml(action.href)}</a></p>`
    : "";

  return `
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <title>${escapeHtml(title)}</title>
      </head>
      <body style="margin:0;background:#f3f4f6;padding:28px 12px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#111827">
        ${preheader ? `<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</div>` : ""}
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;border-collapse:collapse">

                <!-- Brand header -->
                <tr>
                  <td align="center" style="padding:4px 0 20px">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="vertical-align:middle">
                          <img src="${logoUrl}" width="40" height="40" alt="RaceDZ" style="display:block;border-radius:10px" />
                        </td>
                        <td style="vertical-align:middle;padding-left:10px">
                          <span style="font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-0.5px">Race<span style="color:#0f766e">DZ</span></span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Card -->
                <tr>
                  <td style="background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden">
                    <div style="height:6px;background:linear-gradient(90deg,#0f766e,#f97316,#a3e635,#ec4899)"></div>
                    <div style="padding:32px 28px">
                      <h1 style="margin:0;color:#0f172a;font-size:26px;line-height:1.25;font-weight:900">${escapeHtml(title)}</h1>
                      <p style="margin:16px 0 0;color:#374151;font-size:15px;line-height:1.7">${bodyHtml}</p>
                      ${metaHtml}
                      ${actionHtml}
                    </div>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding:22px 6px 0;color:#9ca3af;font-size:12px;line-height:1.7">
                    <div style="font-weight:800;color:#6b7280">RaceDZ — Find, register, and manage races across Algeria.</div>
                    <div style="margin-top:6px">You received this email because you have a RaceDZ account or race registration. Manage notifications anytime from your account settings.</div>
                    <div style="margin-top:12px">© ${year} RaceDZ · <a href="${escapeHtml(appUrl)}" style="color:#0f766e;text-decoration:none">racedz.dz</a></div>
                  </td>
                </tr>

              </table>
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
    "RaceDZ — Find, register, and manage races across Algeria.",
    "",
    title,
    body,
    ...meta.map((item) => `${item.label}: ${item.value}`),
    action ? `${action.label}: ${action.href}` : null,
    "",
    `© ${new Date().getFullYear()} RaceDZ · ${appUrl}`
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
