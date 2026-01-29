# repo-doc
Catálogo de Pós Graduações (lato sensu eMec) Médicas - Set25

# Hotmart → Firebase Webhook

## Descrição

Este projeto implementa um webhook para integração entre Hotmart e Firebase Authentication via Netlify Functions. Ele permite criar ou remover usuários automaticamente no Firebase quando há eventos de compra ou reembolso na Hotmart.

## Funcionalidades

- Recebe eventos Hotmart (v2) via POST.
- Cria usuário no Firebase Authentication quando o evento é `PURCHASE_APPROVED`.
- Remove usuário no Firebase Authentication quando o evento é `PURCHASE_REFUNDED`.
- Validação de token (`hottok`) para segurança.
- Nenhuma credencial sensível está presente no código-fonte.

## Tecnologias

- Node.js
- Netlify Functions
- Firebase Admin SDK
- Hotmart Webhooks v2

## Fluxo

1. Hotmart envia evento via webhook.
2. Netlify Function recebe o evento.
3. Token (`hottok`) é validado.
4. Usuário é criado ou removido no Firebase Authentication conforme o evento.

## Endpoints

| Método | Endpoint |
|--------|----------|
| POST   | `https://catposmedicas.netlify.app/.netlify/functions/hotmart-webhook` |

## Eventos tratados

| Evento Hotmart       | Ação                  |
|---------------------|----------------------|
| PURCHASE_APPROVED    | Cria usuário         |
| PURCHASE_REFUNDED    | Remove usuário       |

## Variáveis de ambiente (Netlify)

| Variável               | Descrição                             |
|------------------------|---------------------------------------|
| FIREBASE_PROJECT_ID     | ID do projeto Firebase                |
| FIREBASE_CLIENT_EMAIL   | Email da service account do Firebase |
| FIREBASE_PRIVATE_KEY    | Chave privada do Firebase             |
| HOTMART_TOKEN           | Token de validação do webhook         |

## Segurança

- Validação do token (`hottok`) para evitar acessos indevidos.
- Nenhuma credencial sensível no código.
- Firebase Admin isolado na Function.

## Estrutura do projeto

/functions
└─ hotmart-webhook.js # Netlify Function principal
/firebase-utils.js # Funções de criação e remoção de usuário no Firebase
.env # Variáveis de ambiente (não commitadas)


## Como usar

1. Configurar as variáveis de ambiente no Netlify.
2. Deploy da função no Netlify.
3. Configurar o webhook na Hotmart apontando para o endpoint da função.
4. Testar eventos reais (compras e reembolsos) para validar o funcionamento.

