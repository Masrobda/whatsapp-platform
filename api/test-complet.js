// test-complet.js
const watiService = require('./src/services/wati.service');

async function testComplet() {
  console.log("=== TEST COMPLET: ENVOI TEMPLATE AVEC PDF ===\n");
  
  // Test 1: Template seul
  console.log("1️⃣ Test template seul:");
  const templateOnly = await watiService.sendTemplateMessage(
    "+237674855790",
    "next_notification_facture",
    {
      entreprise: "NEXT LTD",
      name: "Patrick",
      numero_contrat: "CTR-2026",
      numero_facture: "FACT-001",
      montant: "50 000",
      unpaid: "50 000",
      deadline: "30/05/2026"
    }
  );
  console.log("Résultat template seul:", templateOnly);
  
  // Attendre 2 secondes
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 2: Template avec PDF
  console.log("\n2️⃣ Test template avec PDF:");
  const templateWithPDF = await watiService.sendInvoiceWithPDF(
    "+237674855790",
    "next_notification_facture",
    {
      entreprise: "NEXT LTD",
      name: "Patrick",
      numero_contrat: "CTR-2026",
      numero_facture: "FACT-001",
      montant: "50 000",
      unpaid: "50 000",
      deadline: "30/05/2026"
    },
    {
      pdfUrl: "https://factures.camlight.cm/factures/2026/04/860953401.pdf",
      number: "001"
    }
  );
  console.log("Résultat template avec PDF:", templateWithPDF);
}

testComplet().catch(console.error);
