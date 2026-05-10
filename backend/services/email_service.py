import logging

import resend
from core.config import settings

logger = logging.getLogger(__name__)

SENDER = "VecinUs <noreply@jesuspons.dev>"

# Colores de la app (theme.ts)
_PRIMARY = "#0a7ea4"
_PRIMARY_DARK = "#086a8a"
_GREEN = "#3aab5e"
_BG = "#eef4f7"
_CARD_BG = "#ffffff"
_TEXT = "#11181C"
_TEXT_MUTED = "#687076"

# Logo alojado en Supabase Storage (URL pública, evita base64 que dispara el límite de Gmail)
_LOGO_BLOCK = ""


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


def _resolve_admin_email(supabase_admin, association_id: str) -> tuple[str | None, str | None]:
    """
    Devuelve (email, profile_id) del admin (role=1) de la comunidad.
    Si hay varios admins, devuelve el más antiguo. Si no hay ninguno, (None, None).
    """
    membership_res = (
        supabase_admin.table("memberships")
        .select("profile_id, joined_at")
        .eq("association_id", str(association_id))
        .eq("role", 1)
        .order("joined_at")
        .limit(1)
        .execute()
    )
    if not membership_res.data:
        return (None, None)

    profile_id = str(membership_res.data[0]["profile_id"])
    try:
        user_res = supabase_admin.auth.admin.get_user_by_id(profile_id)
        user = getattr(user_res, "user", None)
        email = getattr(user, "email", None) if user else None
    except Exception:
        logger.exception("Could not fetch admin email for profile %s", profile_id)
        email = None

    return (email, profile_id)


def _build_payment_failed_html(
    association_name: str,
    amount_eur: str,
    failure_reason: str,
    admin_url: str,
) -> str:
    return f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /><title>Cobro fallido — VecinUs</title></head>
<body style="margin:0; padding:0; background-color:{_BG};
             font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background-color:{_BG}; padding:40px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" role="presentation"
             style="background-color:{_CARD_BG}; border-radius:16px;
                    box-shadow:0 4px 24px rgba(0,0,0,0.08); overflow:hidden;
                    max-width:480px; width:100%;">
        <tr>
          <td style="background: linear-gradient(135deg, #c0392b 0%, #922b21 100%);
                     padding:32px 40px 28px; text-align:center;">
            <span style="font-size:26px; font-weight:700; color:#ffffff; letter-spacing:-0.5px;">VecinUs</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px 20px;">
            <h1 style="margin:0 0 12px; font-size:22px; font-weight:700;
                       color:{_TEXT}; line-height:1.3;">
              Cobro fallido en tu comunidad
            </h1>
            <p style="margin:0 0 16px; font-size:15px; color:{_TEXT_MUTED}; line-height:1.6;">
              No hemos podido completar el cobro mensual de la suscripción de
              <strong style="color:{_TEXT};">{association_name}</strong>
              ({amount_eur}). Mientras la suscripción esté impagada, los servicios
              de la comunidad (chatbot, actas, incidencias, etc.) quedan bloqueados.
            </p>
            <div style="background:{_BG}; border-left:4px solid #c0392b;
                        border-radius:6px; padding:10px 18px; margin:0 0 24px;">
              <span style="font-size:13px; color:{_TEXT_MUTED};">Motivo del fallo:</span><br />
              <span style="font-size:14px; font-weight:600; color:{_TEXT};">{failure_reason}</span>
            </div>
            <p style="margin:0 0 28px; font-size:15px; color:{_TEXT_MUTED}; line-height:1.6;">
              Entra en el panel de administración de la comunidad para revisar
              el estado de la suscripción y reintentar el cobro.
            </p>
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr><td style="border-radius:10px;
                         background: linear-gradient(135deg, {_PRIMARY} 0%, {_PRIMARY_DARK} 100%);">
                <a href="{admin_url}"
                   style="display:inline-block; padding:14px 32px;
                          font-size:16px; font-weight:700; color:#ffffff;
                          text-decoration:none; border-radius:10px; letter-spacing:0.2px;">
                  Abrir panel de administración
                </a>
              </td></tr>
            </table>
            <p style="margin:20px 0 0; font-size:12px; color:{_TEXT_MUTED};">
              Si el botón no funciona, copia este enlace en tu navegador:<br />
              <a href="{admin_url}" style="color:{_PRIMARY}; word-break:break-all;">{admin_url}</a>
            </p>
          </td>
        </tr>
        <tr><td style="padding:0 40px;"><hr style="border:none; border-top:1px solid #e8edf0; margin:0;" /></td></tr>
        <tr>
          <td style="padding:20px 40px 32px; text-align:center;">
            <p style="margin:0; font-size:12px; color:{_TEXT_MUTED}; line-height:1.6;">
              Este es un mensaje automático. Si crees que se trata de un error,
              contacta con tu entidad bancaria o con soporte.
            </p>
            <p style="margin:12px 0 0; font-size:11px; color:#9BA1A6;">
              © VecinUs — Gestión de comunidades de vecinos
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def send_payment_failed_email(
    supabase_admin,
    association_id: str,
    association_name: str,
    amount_cents: int,
    currency: str,
    failure_reason: str | None,
) -> bool:
    """
    Envía un email al admin (role=1) de la comunidad notificando que el cobro
    mensual ha fallado y proporcionando un link al panel de administración.

    El link va al FRONTEND (`APP_BASE_URL/{association_id}/admin`), nunca al
    dashboard de GoCardless ni a un endpoint del backend.

    Devuelve True si el email se envió, False si no se pudo (admin sin email,
    Resend caído, etc.). El llamador (worker del webhook) NO debe abortar el
    procesado del evento si esta función falla.
    """
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured; skipping payment_failed email")
        return False

    email, profile_id = _resolve_admin_email(supabase_admin, association_id)
    if not email:
        logger.warning(
            "No admin email found for association %s; payment_failed email skipped (profile_id=%s)",
            association_id,
            profile_id,
        )
        return False

    resend.api_key = settings.RESEND_API_KEY
    admin_url = f"{settings.APP_BASE_URL.rstrip('/')}/{association_id}/admin"

    amount_eur = f"{amount_cents / 100:.2f} {currency or 'EUR'}".replace(".", ",")
    reason_text = (failure_reason or "no especificado").replace("_", " ")

    try:
        resend.Emails.send(
            {
                "from": SENDER,
                "to": [email],
                "subject": f"⚠️ Cobro fallido en {association_name}",
                "html": _build_payment_failed_html(
                    association_name=association_name,
                    amount_eur=amount_eur,
                    failure_reason=reason_text,
                    admin_url=admin_url,
                ),
            }
        )
        logger.info("Payment failed email sent to %s for association %s", email, association_id)
        return True
    except Exception as exc:
        logger.error(
            "Failed to send payment_failed email to %s for association %s: %s",
            email,
            association_id,
            exc,
        )
        return False


def send_voting_email(to_email: str, association_name: str, poll_title: str, token: str) -> None:
    resend.api_key = settings.RESEND_API_KEY
    voting_link = f"{settings.FRONTEND_URL}/votar?token={token}"

    div_style = "max-width: 600px; margin: 0 auto; padding: 20px; " "border: 1px solid #eaeaea; border-radius: 8px;"
    box_style = "background-color: #f8f9fa; padding: 15px; " "border-left: 4px solid #0056b3; margin: 20px 0;"
    btn_style = (
        "background-color: #0056b3; color: white; padding: 12px 25px; "
        "text-decoration: none; border-radius: 5px; font-weight: bold;"
    )

    html_content = f"""
<html>
<body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
<div style="{div_style}">
    <h2 style="color: #2c3e50;">¡Hola!</h2>
    <p>Se ha publicado una nueva votación vinculante en tu comunidad
    <strong>{association_name}</strong> a través de Vecinus.</p>
    <div style="{box_style}">
        <strong>Asunto a votar:</strong><br>
        {poll_title}
    </div>
    <p>Para ejercer tu derecho a voto, haz clic en el siguiente enlace
    personal e intransferible:</p>
    <div style="text-align: center; margin: 30px 0;">
        <a href="{voting_link}" style="{btn_style}">
            Votar Ahora
        </a>
    </div>
    <p style="font-size: 0.9em; color: #666;">
        <em>* Nota legal: Este enlace es de un único uso. Al emitir tu voto,
        tu cuota de participación quedará registrada de forma inmutable.</em>
    </p>
    <br>
    <p>Saludos,<br>El equipo de Vecinus</p>
</div>
</body>
</html>
"""
    try:
        resend.Emails.send(
            {
                "from": SENDER,
                "to": [to_email],
                "subject": f"Nueva votación en tu comunidad: {poll_title}",
                "html": html_content,
            }
        )
        logger.info("Voting email sent to %s", to_email)
    except Exception as e:
        logger.error("Failed to send voting email to %s: %s", to_email, str(e))
