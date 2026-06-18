import axios from 'axios';

export async function sendRiskAlertEmail({
  userId,
  userLabel,
  riskLevel,
  urgency,
  categories,
  shouldAlert,
  summaryForModerator,
  recommendedBotMode
}) {
  const emailData = {
    sender: {
      name: "Blossom IA",
      email: "info@somosblossom.com"
    },
    to: [
      {
        email: "isealuis.miguel@gmail.com",
        name: "Luis Isea"
      },
      {
        email: "seijasvillaltagabriel@gmail.com",
        name: "Gabriel Seijas"
      },
      {
        email: "info@somosblossom.com",
        name: "Blossom IA",
      }
    ],
    subject: `⚠️ ALERTA DE RIESGO: Nivel ${riskLevel.toUpperCase()} detectado`,
    htmlContent: `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; background-color: #f9f9f9; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; border-top: 4px solid #d9534f; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #d9534f; margin-top: 0;">Alerta de Seguridad - Blossom IA</h2>
            <p>Se ha detectado un evento que requiere revisión por parte del equipo de moderación.</p>

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #ddd; width: 35%;">Usuario:</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${userLabel} (ID: ${userId})</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #ddd;">Nivel de Riesgo:</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><span style="background-color: #d9534f; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${riskLevel.toUpperCase()}</span></td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #ddd;">Urgencia:</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${urgency.toUpperCase()}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #ddd;">Categorías:</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${categories.join(', ') || 'Ninguna'}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #ddd;">Modo del Bot:</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${recommendedBotMode}</td>
              </tr>
            </table>

            <div style="background-color: #f2dede; color: #a94442; padding: 15px; border-radius: 4px; border: 1px solid #ebccd1; margin-top: 15px;">
              <h3 style="margin-top: 0; color: #a94442;">Resumen para Moderación:</h3>
              <p style="font-style: italic; margin-bottom: 0; white-space: pre-line;">"${summaryForModerator}"</p>
            </div>

            <p style="font-size: 12px; color: #777; margin-top: 25px; text-align: center;">Este es un mensaje automático generado por el sistema de monitorización de Blossom IA.</p>
          </div>
        </body>
      </html>
    `
  };

  try {
    const response = await axios.post('https://api.brevo.com/v3/smtp/email', emailData, {
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': process.env.BREVO_API_KEY
      }
    });

    console.log(`✉️ Correo enviado vía API REST de Brevo con éxito. Message-ID:`, response.data.messageId);
    return response.data;
  } catch (error) {
    console.error('❌ Error crítico en el POST directo a Brevo:', error.response?.data || error.message);
    throw error;
  }
}
