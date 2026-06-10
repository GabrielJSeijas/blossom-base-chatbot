import * as Brevo from '@getbrevo/brevo';

// Inicializar el cliente de Brevo con la API Key
const apiInstance = new Brevo.TransactionalEmailsApi();
apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

/**
 * Envía un correo de alerta de riesgo crítico o alto a los administradores.
 * @param {Object} alert - Objeto de la alerta proveniente del endpoint de riesgo
 */
export async function sendRiskAlertEmail(alert) {
  const { userLabel, riskLevel, urgency, categories, summaryForModerator, userId } = alert;

  // Lista de destinatarios cargados en tu plataforma
  const toAddresses = [
    { email: 'info@somosblossom.com', name: 'Blossom Info' },
    { email: 'isea.luis.miguel@gmail.com', name: 'Luis Miguel' },
    { email: 'seijasvillaltagabriel@gmail.com', name: 'Gabriel Seijas' }
  ];

  const sendSmtpEmail = new Brevo.SendSmtpEmail();

  sendSmtpEmail.subject = `🚨 ALERTA DE RIESGO ${riskLevel.toUpperCase()} - Usuario: ${userLabel}`;
  sendSmtpEmail.sender = { email: 'info@somosblossom.com', name: 'Blossom Security Alert' };
  sendSmtpEmail.to = toAddresses;

  // Cuerpo del correo estructurado de manera legible y profesional
  sendSmtpEmail.htmlContent = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="background-color: #ffebee; padding: 20px; border-radius: 8px; border-left: 8px solid #d32f2f;">
          <h2 style="color: #c62828; margin-top: 0;">⚠️ Alerta de Seguridad del Sistema - Blossom</h2>
          <p>Se ha detectado una situación de riesgo elevado que requiere atención inmediata de los administradores.</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 8px; font-weight: bold; width: 150px; border-bottom: 1px solid #ddd;">Apodo (Label):</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${userLabel}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #ddd;">ID de Usuario:</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;"><code>${userId}</code></td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #ddd;">Nivel de Riesgo:</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;"><span style="background-color: #d32f2f; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${riskLevel.toUpperCase()}</span></td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #ddd;">Urgencia:</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${urgency.toUpperCase()}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #ddd;">Categorías Clínicas:</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${categories.join(', ')}</td>
            </tr>
          </table>

          <div style="background-color: #ffffff; padding: 15px; border-radius: 4px; border: 1px solid #ccc; margin-top: 15px;">
            <h3 style="margin-top: 0; color: #444;">Resumen para el Terapeuta / Moderador:</h3>
            <p style="font-style: italic; white-space: pre-line;">"${summaryForModerator}"</p>
          </div>

          <p style="font-size: 12px; color: #777; margin-top: 25px;">Este es un mensaje automático generado por el backend de Blossom IA al procesar un riesgo alto o crítico.</p>
        </div>
      </body>
    </html>
  `;

  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`✉️ Correo de alerta enviado exitosamente a los administradores. MessageId: ${data.messageId}`);
    return data;
  } catch (error) {
    console.error('❌ Error enviando el correo de riesgo a través de Brevo:', error);
    // No arrojamos el error (throw) para evitar que tumbe el flujo principal del chat del usuario
  }
}
