import { createUser, deleteUser } from './firebase-utils.js';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  const payload = JSON.parse(event.body || '{}');
  const eventType = payload.event;
  const email = payload?.data?.customer?.email;

  if (!email) {
    return {
      statusCode: 400,
      body: 'Email não encontrado no payload'
    };
  }

  // COMPRA APROVADA
  if (eventType === 'TRANSACTION.APPROVED') {
    await createUser(email);
    return {
      statusCode: 200,
      body: 'Usuário criado'
    };
  }

  // REEMBOLSO
  if (eventType === 'TRANSACTION.REFUNDED') {
    await deleteUser(email);
    return {
      statusCode: 200,
      body: 'Usuário removido'
    };
  }

  // QUALQUER OUTRO EVENTO
  return {
    statusCode: 200,
    body: 'Evento ignorado'
  };
}
