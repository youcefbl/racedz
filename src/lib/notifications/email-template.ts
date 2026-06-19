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

export function renderRaceDzEmailHtml({ preheader, title, body, action, meta = [] }: RaceDzEmailTemplateInput) {
  const actionHtml = action
    ? `<a href="${escapeHtml(action.href)}" style="display:inline-block;border-radius:10px;background:#f97316;color:#ffffff;padding:13px 18px;text-decoration:none;font-weight:800">${escapeHtml(action.label)}</a>`
    : "";
  const metaHtml = meta.length
    ? `<div style="margin-top:24px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">${meta
        .map(
          (item) => `
            <div style="display:flex;gap:12px;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #f3f4f6">
              <span style="color:#6b7280;font-size:13px">${escapeHtml(item.label)}</span>
              <strong style="color:#111827;font-size:13px;text-align:right">${escapeHtml(item.value)}</strong>
            </div>
          `
        )
        .join("")}</div>`
    : "";

  return `
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <title>${escapeHtml(title)}</title>
      </head>
      <body style="margin:0;background:#f3f4f6;padding:28px 12px;font-family:Inter,Arial,sans-serif;color:#111827">
        ${preheader ? `<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</div>` : ""}
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;border-collapse:collapse">
                <tr>
                  <td style="padding:0 0 16px">
                    <div style="font-size:22px;font-weight:900;color:#0f766e;letter-spacing:0">RaceDZ</div>
                    <div style="margin-top:4px;color:#6b7280;font-size:13px">Find, register, and manage races across Algeria.</div>
                  </td>
                </tr>
                <tr>
                  <td style="background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden">
                    <div style="height:6px;background:linear-gradient(90deg,#0f766e,#f97316,#39ff14,#ff2bd6)"></div>
                    <div style="padding:30px 26px">
                      <h1 style="margin:0;color:#111827;font-size:28px;line-height:1.2;font-weight:900">${escapeHtml(title)}</h1>
                      <p style="margin:16px 0 0;color:#374151;font-size:15px;line-height:1.7">${escapeHtml(body)}</p>
                      ${metaHtml}
                      ${actionHtml ? `<div style="margin-top:28px">${actionHtml}</div>` : ""}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 2px 0;color:#6b7280;font-size:12px;line-height:1.6">
                    You received this email because you have a RaceDZ account or race registration. Manage notification preferences from your account settings.
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
  return [
    "RaceDZ",
    title,
    body,
    ...meta.map((item) => `${item.label}: ${item.value}`),
    action ? `${action.label}: ${action.href}` : null
  ]
    .filter(Boolean)
    .join("\n\n");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
