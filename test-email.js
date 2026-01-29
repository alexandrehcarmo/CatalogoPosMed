import nodemailer from "nodemailer";

// Configuração do SMTP usando variáveis de ambiente
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // seu email
    pass: process.env.EMAIL_PASS, // App Password sem espaços
  },
});

// Função para enviar email de teste
async function sendTestEmail() {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // envia para você mesmo apenas para teste
      subject: "Teste Webhook SMTP",
      text: "Se você recebeu este email, SMTP e Netlify Variables estão funcionando!",
    });
    console.log("Email enviado com sucesso:", info.response);
  } catch (error) {
    console.error("Erro ao enviar email:", error);
  }
}

// Executa a função
sendTestEmail();
