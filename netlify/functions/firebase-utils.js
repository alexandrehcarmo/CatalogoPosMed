import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// Caminho absoluto do Windows para o JSON do Firebase
const serviceAccountPath = 'E:\\PROJETOS PESSOAIS\\CatalogoPosMed\\netlify\\functions\\firebase-key.json';


const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// Inicializa Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://catalogoposmed.firebaseio.com'
  });
}

// Função para criar usuário
export async function createUser(email) {
  try {
    const user = await admin.auth().createUser({ email });
    console.log('Usuário criado:', email);
    return user;
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
  }
}

// Função para deletar usuário
export async function deleteUser(email) {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().deleteUser(user.uid);
    console.log('Usuário deletado:', email);
    return true;
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
  }
}
