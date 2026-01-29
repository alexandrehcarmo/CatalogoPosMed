import { createUser, deleteUser } from "./firebase-utils.js";

export async function handler(event) {
  try {
    const body = JSON.parse(event.body);

    const eventType = body.event;
    const email = body?.data?.buyer?.email;

    if (!email) {
      return {
        statusCode: 400,
        body: "Email não encontrado no payload",
      };
    }

    if (eventType === "PURCHASE_APPROVED") {
      await createUser(email);
      return {
        statusCode: 200,
        body: "Usuário criado",
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
