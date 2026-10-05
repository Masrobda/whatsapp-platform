// app/api/invoices/[id]/download/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Attendre la résolution des params (Next.js 15)
    const { id: invoiceId } = await context.params;
    const token = (await cookies()).get('token')?.value;

    console.log('🔍 [API Proxy] Début téléchargement facture:', invoiceId);
    console.log('🔍 [API Proxy] Token présent:', !!token);

    if (!token) {
      console.error('❌ [API Proxy] Token manquant');
      return NextResponse.json(
        { success: false, message: 'Non autorisé' },
        { status: 401 }
      );
    }

    // URL de l'API backend
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/orders/invoices/${invoiceId}/download`;
    console.log('🔍 [API Proxy] URL backend:', apiUrl);

    // Appeler l'API backend
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/pdf',
      },
      cache: 'no-store',
    });

    console.log('🔍 [API Proxy] Réponse backend:', response.status, response.statusText);

    if (!response.ok) {
      let errorMessage = `Erreur ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        errorMessage = await response.text() || errorMessage;
      }
      
      console.error('❌ [API Proxy] Erreur backend:', errorMessage);
      throw new Error(errorMessage);
    }

    // Récupérer le PDF
    const pdfBuffer = await response.arrayBuffer();
    const pdfData = Buffer.from(pdfBuffer);

    // Déterminer le nom de fichier
    const contentDisposition = response.headers.get('content-disposition');
    let filename = `facture_${invoiceId}.pdf`;
    
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="([^"]+)"/);
      if (match) {
        filename = match[1];
        console.log('🔍 [API Proxy] Nom de fichier détecté:', filename);
      }
    }

    console.log('✅ [API Proxy] PDF récupéré:', {
      size: pdfData.length,
      filename: filename,
    });

    // Retourner le PDF
    return new NextResponse(pdfData, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfData.length.toString(),
      },
    });

  } catch (error: any) {
    console.error('❌ [API Proxy] Erreur téléchargement PDF:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Erreur lors du téléchargement du PDF',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
