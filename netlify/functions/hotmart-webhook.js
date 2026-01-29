import { createUser, deleteUser } from "./firebase-utils.js";
import nodemailer from "nodemailer"; // enviar emails

// Gera senha aleatória segura
function generatePassword(length = 12) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Configuração do email (SMTP)
const transporter = nodemailer.createTransport({
  service: "gmail", // ou outro serviço SMTP
  auth: {
    user: process.env.EMAIL_USER, // criar variável de ambiente no Netlify
    pass: process.env.EMAIL_PASS, // senha ou token SMTP
  },
});

// Função para enviar email com a senha
async function sendPasswordEmail(to, password) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: "Sua conta no Catálogo de Pós Médicas",
    text: `Olá!\n\nSua conta foi criada automaticamente.\n\nEmail: ${to}\nSenha: ${password}\n\nAcesse aqui: https://catposmedicas.netlify.app/login.html`,
  };
  await transporter.sendMail(mailOptions);
}

export async function handler(event) {
  try {
    const body = JSON.parse(event.body);

    // Validação do token
    if (body.hottok !== process.env.HOTMART_TOKEN) {
      return {
        statusCode: 401,
        body: "Token inválido",
      };
    }

    const eventType = body.event;
    const email = body?.data?.buyer?.email;

    if (!email) {
      return {
        statusCode: 400,
        body: "Email não encontrado no payload",
      };
    }

    if (eventType === "PURCHASE_APPROVED") {
      // Gera senha aleatória
      const password = generatePassword();

      // Cria usuário com senha
      await createUser(email, password);

      // Envia email com senha
      await sendPasswordEmail(email, password);

      return {
        statusCode: 200,
        body: "Usuário criado e email enviado",
      };
    }

    if (eventType === "PURCHASE_REFUNDED") {
      await deleteUser(email);
      return {
        statusCode: 200,
        body: "Usuário removido",
      };
    }

    return {
      statusCode: 200,
      body: "Evento ignorado",
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: "Erro interno",
    };
  }
}
