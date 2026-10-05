import Link from 'next/link';

export default function LegalPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Mentions Légales
          </h1>
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-600 mb-4">
              Cette page est actuellement en cours de préparation.
            </p>
            <p className="text-gray-600">
              Nous travaillons à vous fournir les informations nécessaires. 
              Revenez bientôt pour consulter nos Mentions Légales.
            </p>
            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <p className="text-blue-800">
                <strong>Information :</strong> Pour toute question concernant nos Mentions Légales, 
                veuillez nous contacter à <a href="mailto:team@numericexport.com" className="text-blue-600 underline">team@numericexport.com</a>
              </p>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-gray-200">
            <Link href="/" className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center">
              ← Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
