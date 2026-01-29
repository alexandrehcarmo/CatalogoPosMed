import admin from "firebase-admin";

// Inicialização do Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

// Cria usuário no Firebase Auth
export async function createUser(email, password) {
  try {
    // Se password não for fornecida, cria usuário apenas com email
    const userData = password ? { email, password } : { email };
    const user = await admin.auth().createUser(userData);
    console.log("Usuário criado:", email);
    return user;
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    throw error;
  }
}

// Remove usuário no Firebase Auth
export async function deleteUser(email) {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().deleteUser(user.uid);
    console.log("Usuário deletado:", email);
    return true;
  } catch (error) {
    console.error("Erro ao deletar usuário:", error);
    throw error;
  }
}
