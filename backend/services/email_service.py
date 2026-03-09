import logging

import resend
from core.config import settings

logger = logging.getLogger(__name__)

SENDER = "VecinUs <onboarding@resend.dev>"

# Colores de la app (theme.ts)
_PRIMARY = "#0a7ea4"
_PRIMARY_DARK = "#086a8a"
_GREEN = "#3aab5e"
_BG = "#eef4f7"
_CARD_BG = "#ffffff"
_TEXT = "#11181C"
_TEXT_MUTED = "#687076"

# Logo alojado en Supabase Storage (URL pública, evita base64 que dispara el límite de Gmail)
_LOGO_SRC = "https://asgmplswntnjkxtyebvb.supabase.co/storage/v1/object/public/assets/logo.png"

_LOGO_BLOCK = (
    f'<img src="{_LOGO_SRC}" alt="VecinUs" width="72" height="72"' ' style="display:block; margin:0 auto 12px;" />'
)


def _build_html(accept_url: str, role_label: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invitación a VecinUs</title>
</head>
<body style="margin:0; padding:0; background-color:{_BG};
             font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

  <!-- wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background-color:{_BG}; padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- card -->
        <table width="480" cellpadding="0" cellspacing="0" role="presentation"
               style="background-color:{_CARD_BG}; border-radius:16px;
                      box-shadow:0 4px 24px rgba(0,0,0,0.08); overflow:hidden;
                      max-width:480px; width:100%;">

          <!-- header band -->
          <tr>
            <td style="background: linear-gradient(135deg, {_PRIMARY} 0%, {_PRIMARY_DARK} 100%);
                       padding:32px 40px 28px; text-align:center;">
              {_LOGO_BLOCK}
              <span style="font-size:26px; font-weight:700; color:#ffffff;
                           letter-spacing:-0.5px;">VecinUs</span>
            </td>
          </tr>

          <!-- body -->
          <tr>
            <td style="padding:36px 40px 20px;">
              <h1 style="margin:0 0 12px; font-size:22px; font-weight:700;
                         color:{_TEXT}; line-height:1.3;">
                ¡Has recibido una invitación!
              </h1>
              <p style="margin:0 0 8px; font-size:15px; color:{_TEXT_MUTED}; line-height:1.6;">
                Alguien te ha invitado a unirte a su comunidad de vecinos como:
              </p>

              <!-- role badge -->
              <div style="display:inline-block; margin:12px 0 24px;
                          background:{_BG}; border-left:4px solid {_PRIMARY};
                          border-radius:6px; padding:10px 18px;">
                <span style="font-size:16px; font-weight:600; color:{_PRIMARY};">
                  {role_label}
                </span>
              </div>

              <p style="margin:0 0 28px; font-size:15px; color:{_TEXT_MUTED}; line-height:1.6;">
                Haz clic en el botón para crear tu cuenta y unirte a la comunidad.
                Solo te llevará un momento.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="border-radius:10px;
                             background: linear-gradient(135deg, {_GREEN} 0%, #2d8f4f 100%);">
                    <a href="{accept_url}"
                       style="display:inline-block; padding:14px 32px;
                              font-size:16px; font-weight:700; color:#ffffff;
                              text-decoration:none; border-radius:10px;
                              letter-spacing:0.2px;">
                      Aceptar invitación
                    </a>
                  </td>
                </tr>
              </table>

              <!-- fallback link -->
              <p style="margin:20px 0 0; font-size:12px; color:{_TEXT_MUTED};">
                Si el botón no funciona, copia este enlace en tu navegador:<br />
                <a href="{accept_url}"
                   style="color:{_PRIMARY}; word-break:break-all;">{accept_url}</a>
              </p>
            </td>
          </tr>

          <!-- divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none; border-top:1px solid #e8edf0; margin:0;" />
            </td>
          </tr>

          <!-- footer -->
          <tr>
            <td style="padding:20px 40px 32px; text-align:center;">
              <p style="margin:0; font-size:12px; color:{_TEXT_MUTED}; line-height:1.6;">
                Si no esperabas esta invitación, puedes ignorar este email con total seguridad.<br />
                El enlace quedará invalidado en cuanto sea utilizado.
              </p>
              <p style="margin:12px 0 0; font-size:11px; color:#9BA1A6;">
                © VecinUs — Gestión de comunidades de vecinos
              </p>
            </td>
          </tr>

        </table>
        <!-- /card -->

      </td>
    </tr>
  </table>
  <!-- /wrapper -->

</body>
</html>"""


def send_invitation_email(target_email: str, invitation_id: str, role_label: str) -> None:
    """
    Envía un email de invitación con un link para aceptarla.
    Si RESEND_API_KEY no está configurada, loguea un warning y no falla.
    """
    resend.api_key = settings.RESEND_API_KEY
    accept_url = f"{settings.APP_BASE_URL}/auth/accept-invitation?token={invitation_id}"

    try:
        resend.Emails.send(
            {
                "from": SENDER,
                "to": [target_email],
                "subject": f"Invitación a VecinUs como {role_label}",
                "html": _build_html(accept_url, role_label),
            }
        )
        logger.info("Invitation email sent to %s", target_email)
    except Exception as e:
        logger.error("Failed to send invitation email to %s: %s", target_email, str(e))


ROLE_LABELS = {
    2: "Propietario",
    3: "Inquilino",
    4: "Presidente",
    5: "Empleado",
}
