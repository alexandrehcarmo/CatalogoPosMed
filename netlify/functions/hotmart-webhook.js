import { createUser, deleteUser } from "./firebase-utils.js";
import nodemailer from "nodemailer";

// Gera senha aleatória
function generatePassword(length = 12) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Configuração do email
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Envia email com senha
async function sendPasswordEmail(to, password) {
  try {
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to,
          subject: "Sua conta no Catálogo de Pós Médicas",
          text: `Olá!\n\nSua conta foi criada automaticamente.\n\nEmail: ${to}\nSenha: ${password}\n\nAcesse: https://catposmedicas.netlify.app/login.html`,
        };
        await transporter.sendMail(mailOptions);
      } catch (err) {
        console.error("Erro ao enviar email:", err);
        // Não interrompe a função
      }
    }

    export async function handler(event) {
      try {
            // Pegando token do body ou do header
            const hottokReceived = body.hottok || event.headers["hottok"] || event.headers["Hotmart-Token"];

            if (hottokReceived !== process.env.HOTMART_TOKEN) {
              return {
                statusCode: 401,
                body: "Token inválido",
              };
            }

            const eventType = body.event;
            const email = body?.data?.buyer?.email;

            if (!email) {
              return { statusCode: 400, body: "Email não encontrado no payload" };
            }

            if (eventType === "PURCHASE_APPROVED") {
              try {
                const password = generatePassword();
                await createUser(email, password);
                await sendPasswordEmail(email, password);
                console.log(`Usuário criado e email enviado: ${email}`);
              } catch (err) {
                console.error("Erro na criação de usuário ou envio de email:", err);
                // Continua mesmo que dê erro para evitar 502
              }
              return { statusCode: 200, body: "Usuário processado (veja logs para detalhes)" };
            }

            if (eventType === "PURCHASE_REFUNDED") {
              try {
                await deleteUser(email);
                console.log(`Usuário removido: ${email}`);
              } catch (err) {
                console.error("Erro ao remover usuário:", err);
              }
              return { statusCode: 200, body: "Usuário processado (veja logs para detalhes)" };
            }

            return { statusCode: 200, body: "Evento ignorado" };
      } catch (err) {
        console.error("Erro interno do webhook:", err);
        return { statusCode: 200, body: "Webhook recebeu evento, mas houve erro interno (veja logs)" };
  }
}
