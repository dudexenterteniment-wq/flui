// Configuração pública do Firebase (não é senha: a proteção dos dados vem das regras do Firestore).
// Deixe FIREBASE_CONFIG = null para usar o modo de teste local (dados só neste navegador).
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDSkI31cRgpknRAIKXgW6aWDdm9mCztb8I',
  authDomain: 'flui-77871.firebaseapp.com',
  projectId: 'flui-77871',
  storageBucket: 'flui-77871.firebasestorage.app',
  messagingSenderId: '255518018699',
  appId: '1:255518018699:web:d9981ff07751ca8be9d88e',
};
export const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
// Chave pública de notificações (Firebase → Configurações do projeto → Cloud Messaging → Certificados push da Web). Pública, não é senha.
export const VAPID_KEY = '';
