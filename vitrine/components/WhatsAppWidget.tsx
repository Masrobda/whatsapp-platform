'use client';

import { FloatingWhatsApp } from 'react-floating-whatsapp';

export default function WhatsAppWidget() {
  // Fonction avec typage correct : event de type 'unknown' (car non utilisé)
  const handleSubmit = (event: unknown, inputValue: string) => {
    console.log("Le message suivant va être envoyé à WhatsApp :", inputValue);
    // La bibliothèque se charge de la redirection
  };

  return (
    <FloatingWhatsApp
      phoneNumber="237696578107"
      accountName="NEXT LTD"
      avatar="https://dashboard.numericexport.com/logook3.png"
      chatMessage="Salut! Comment puis-je t'aider?"
      statusMessage="En ligne | Réponse instantanée"
      placeholder="Écrivez votre message..."
      darkMode={false}
      buttonStyle={{
        backgroundColor: '#FFFFFF',
        color: '#25D366',
      }}
      chatboxStyle={{
        backgroundColor: '#075E54',
        color: '#FFFFFF',
      }}
      onSubmit={handleSubmit}
    />
  );
}
