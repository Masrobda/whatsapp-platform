// test-wati.js
const watiService = require('./src/services/wati.service');

async function testWati() {
  console.log("Test 1: Vérifier configuration");
  const testResult = await watiService.testAPI();
  console.log("Test API:", testResult);
  
  if (!testResult.success) {
    console.log("❌ Problème de connexion WATI");
    return;
  }
  
  console.log("\nTest 2: Envoyer template simple");
  const templateResult = await watiService.sendTemplateMessage(
    "+237656939193",
    "next_envoice_template",
    {
      entreprise: "NEXT LTD",
      name: "Patrick",
      numero_contrat: "CTR-2026",
      numero_facture: "FACT-001",
      montant: "50000",
      unpaid: "0",
      deadline: "30/05/2026"
    }
  );
  console.log("Résultat template:", templateResult);
  
  console.log("\nTest 3: Envoyer PDF séparément");
  const pdfResult = await watiService.sendPDFDocument(
    "+237656939193",
    {
      pdfUrl: "https://factures.camlight.cm/factures/2026/04/860953401.pdf",
      number: "001"
    }
  );
  console.log("Résultat PDF:", pdfResult);
}

testWati();
