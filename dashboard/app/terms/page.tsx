// app/terms/page.tsx
'use client';
import Link from 'next/link';

export default function TermsPage() {
  const lastUpdate = "24 Février 2026";
  const effectiveDate = "1er Mars 2026";
  return (
    <main className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8 md:p-12">
          {/* En-tête */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Conditions Générales d&apos;Utilisation
            </h1>
            <div className="flex flex-wrap gap-4 text-sm">
              <p className="text-gray-600">Dernière mise à jour : {lastUpdate}</p>
              <p className="text-gray-600">Date d&apos;effet : {effectiveDate}</p>
            </div>
            <div className="w-20 h-1 bg-blue-600 mt-4"></div>
          </div>

          {/* Introduction légale */}
          <div className="prose prose-lg max-w-none">
            <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-8">
              <p className="text-blue-800 font-medium">
                Les présentes Conditions Générales d&apos;Utilisation régissent l&apos;accès et l&apos;utilisation
                des services de NEXT LTD, y compris notre plateforme d&apos;envoi de messages WhatsApp,
                nos APIs, et nos solutions logicielles. En utilisant nos services, vous acceptez
                ces conditions dans leur intégralité.
              </p>
            </div>

            {/* Article 1 - Définitions */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Article 1 : Définitions
              </h2>
              <dl className="space-y-3">
                <div>
                  <dt className="font-bold">Client / Utilisateur :</dt>
                  <dd className="pl-4">Toute personne physique ou morale utilisant les services de NEXT LTD.</dd>
                </div>
                <div>
                  <dt className="font-bold">Services :</dt>
                  <dd className="pl-4">L&apos;ensemble des prestations fournies par NEXT LTD, incluant l&apos;API WhatsApp, les solutions de développement, le marketing digital, et les services d&apos;infrastructure.</dd>
                </div>
                <div>
                  <dt className="font-bold">API WhatsApp :</dt>
                  <dd className="pl-4">L&apos;interface de programmation permettant l&apos;envoi de messages via la plateforme WhatsApp Business.</dd>
                </div>
                <div>
                  <dt className="font-bold">Destinataire :</dt>
                  <dd className="pl-4">Toute personne recevant des messages via notre service WhatsApp.</dd>
                </div>
                <div>
                  <dt className="font-bold">Consentement :</dt>
                  <dd className="pl-4">L&apos;accord explicite et vérifiable du destinataire à recevoir des messages WhatsApp.</dd>
                </div>
              </dl>
            </section>

            {/* Article 2 - Acceptation des conditions */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Article 2 : Acceptation des conditions
              </h2>
              <p className="mb-3">
                L&apos;utilisation des services NEXT LTD implique l&apos;acceptation pleine et entière
                des présentes conditions. Cette acceptation est matérialisée par :
              </p>
              <ul className="list-disc pl-6">
                <li>La création d&apos;un compte sur notre plateforme</li>
                <li>La case à cocher &quot;J&apos;accepte les conditions générales&quot; lors de l&apos;inscription</li>
                <li>L&apos;utilisation continue de nos services</li>
                <li>La validation de tout devis ou contrat spécifique</li>
              </ul>
            </section>

            {/* Article 3 - Conditions spécifiques WhatsApp */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Article 3 : Conditions spécifiques à l&apos;API WhatsApp
              </h2>
              <h3 className="text-xl font-medium text-gray-800 mb-3">3.1 Conformité avec les politiques WhatsApp</h3>
              <p className="mb-3">Le Client s&apos;engage à respecter strictement :</p>
              <ul className="list-disc pl-6 mb-4">
                <li>Les <strong>Politiques Commerciales WhatsApp</strong> (interdiction de certains contenus)</li>
                <li>Les <strong>limites de qualité WhatsApp</strong> (taux de conversation, taux de blocage)</li>
                <li>L&apos;obtention d&apos;un <strong>consentement explicite</strong> avant tout message</li>
                <li>L&apos;inclusion d&apos;une <strong>option de désabonnement</strong> dans chaque message</li>
                <li>Le respect des <strong>plages horaires</strong> recommandées pour l&apos;envoi</li>
              </ul>
              <h3 className="text-xl font-medium text-gray-800 mb-3">3.2 Catégories de messages autorisées</h3>
              <div className="overflow-x-auto mb-4">
                <table className="min-w-full border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border p-3">Type de message</th>
                      <th className="border p-3">Description</th>
                      <th className="border p-3">Consentement requis</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border p-3">Transactionnel</td>
                      <td className="border p-3">Confirmations de commande, notifications de livraison</td>
                      <td className="border p-3">Implicite (relation existante)</td>
                    </tr>
                    <tr>
                      <td className="border p-3">Marketing</td>
                      <td className="border p-3">Offres promotionnelles, newsletters</td>
                      <td className="border p-3">Explicite (opt-in)</td>
                    </tr>
                    <tr>
                      <td className="border p-3">Support</td>
                      <td className="border p-3">Service client, assistance technique</td>
                      <td className="border p-3">Explicite ou initié par client</td>
                    </tr>
                    <tr>
                      <td className="border p-3">Authentification</td>
                      <td className="border p-3">Codes OTP, vérifications</td>
                      <td className="border p-3">Par utilisation du service</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <h3 className="text-xl font-medium text-gray-800 mb-3">3.3 Engagement de qualité</h3>
              <p className="mb-3">Le Client s&apos;engage à maintenir :</p>
              <ul className="list-disc pl-6">
                <li>Un taux de conversation supérieur à 70%</li>
                <li>Un taux de blocage inférieur à 1%</li>
                <li>Un taux de spam nul</li>
                <li>Un traitement des désabonnements sous 24h</li>
              </ul>
              <p className="mt-2 text-sm text-gray-600">
                Le non-respect de ces indicateurs peut entraîner la suspension du service par WhatsApp.
              </p>
            </section>

            {/* Article 4 - Création de compte et authentification */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Article 4 : Création de compte et authentification
              </h2>
              <p className="mb-3">Lors de la création de votre compte :</p>
              <ul className="list-disc pl-6">
                <li>Vous devez fournir des informations exactes et à jour</li>
                <li>Vous êtes responsable de la confidentialité de vos identifiants</li>
                <li>L&apos;authentification à deux facteurs (2FA) est obligatoire</li>
                <li>Toute activité via votre compte vous est imputable</li>
                <li>Vous devez notifier immédiatement toute utilisation non autorisée</li>
              </ul>
            </section>

            {/* Article 5 - Obligations du Client */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Article 5 : Obligations du Client
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Utiliser les services conformément aux lois camerounaises et internationales</li>
                <li>Ne pas envoyer de contenu illégal, diffamatoire, ou frauduleux</li>
                <li>Respecter les droits de propriété intellectuelle</li>
                <li>Ne pas tenter de contourner les mesures de sécurité</li>
                <li>Ne pas revendre les services sans autorisation écrite</li>
                <li>Conserver les preuves de consentement pour les envois WhatsApp</li>
                <li>Respecter les limites d&apos;utilisation définies dans son offre</li>
              </ul>
            </section>

            {/* Article 6 - Données et propriété intellectuelle */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Article 6 : Propriété intellectuelle
              </h2>
              <p className="mb-3">
                NEXT LTD conserve tous les droits de propriété intellectuelle sur :
              </p>
              <ul className="list-disc pl-6">
                <li>La plateforme et son code source</li>
                <li>Les APIs et leurs documentations</li>
                <li>Les marques et logos NEXT LTD</li>
                <li>Les algorithmes et processus propriétaires</li>
              </ul>
              <p className="mt-3">
                Le Client conserve la propriété de ses données et contenus, mais accorde à NEXT LTD
                une licence d&apos;utilisation pour la fourniture des services.
              </p>
            </section>

            {/* Article 7 - Tarifs et facturation */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Article 7 : Tarifs et facturation
              </h2>
              <ul className="list-disc pl-6">
                <li>Les prix sont indiqués en FCFA (francs CFA) hors taxes</li>
                <li>La TVA de 19.25% s&apos;applique conformément à la législation camerounaise</li>
                <li>La facturation est périodique selon l&apos;accord avec le client et tient compte des accords du contrat</li>
                <li>Les messages WhatsApp sont facturés par conversation initiée</li>
                <li>Le paiement s&apos;effectue par virement bancaire, carte ou mobile money dans le respect des lois en vigueur</li>
                <li>Tout retard de paiement entraîne des pénalités de 1.5% par mois</li>
              </ul>
            </section>

            {/* Article 8 - Support et maintenance */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Article 8 : Support et maintenance
              </h2>
              <p className="mb-3">NEXT LTD s&apos;engage à fournir :</p>
              <ul className="list-disc pl-6">
                <li>Un support technique régulier pour chaque client (support@numericexport.com)</li>
                <li>Une hotline d&apos;urgence au (+237) 696 57 81 07 / 651 01 90 69</li>
                <li>Une maintenance programmée avec préavis de 48h</li>
                <li>Une disponibilité de la plateforme de 99.5% (hors maintenance)</li>
                <li>Une gestion des incidents critiques sous 24h</li>
              </ul>
            </section>

            {/* Article 9 - Responsabilité */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Article 9 : Responsabilité
              </h2>
              <ul className="list-disc pl-6">
                <li>NEXT LTD ne peut être tenu responsable des suspensions imposées par WhatsApp</li>
                <li>NEXT LTD ne peut être tenu responsable de l&apos;indisponibilité du réseau chez le client ou chez les fournisseurs d&apos;accès internet</li>
                <li>NEXT LTD n&apos;est pas responsable des dommages indirects (perte de chiffre d&apos;affaires, etc.)</li>
                <li>Le Client est seul responsable du contenu de ses messages et des consentements</li>
              </ul>
            </section>

            {/* Article 10 - Durée et résiliation */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Article 10 : Durée et résiliation
              </h2>
              <p className="mb-3">Le contrat est conclu pour une durée selon les accords avec les clients toutefois la durée ne peut être inférieure à une période de trois (03) mois.</p>
              <p className="mb-2"><strong>Résiliation par le Client :</strong></p>
              <ul className="list-disc pl-6 mb-3">
                <li>À tout moment, sans frais</li>
                <li>Par email à team@numericexport.com</li>
                <li>Effective immédiatement après confirmation</li>
              </ul>
              <p className="mb-2"><strong>Résiliation par NEXT LTD :</strong></p>
              <ul className="list-disc pl-6">
                <li>Pour non-paiement : résiliation immédiate après mise en demeure</li>
                <li>Pour violation des conditions : résiliation sous 7 jours</li>
                <li>Pour non-respect des politiques WhatsApp : résiliation immédiate</li>
              </ul>
            </section>

            {/* Article 11 - Suspension par WhatsApp */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Article 11 : Suspension par WhatsApp
              </h2>
              <p className="mb-3">
                En cas de suspension du numéro de téléphone ou du compte WhatsApp Business du Client :
              </p>
              <ul className="list-disc pl-6">
                <li>NEXT LTD informera le Client dans les plus brefs délais</li>
                <li>Les causes de suspension seront communiquées (si disponibles)</li>
                <li>Le Client devra corriger les violations identifiées</li>
                <li>NEXT LTD assistera le Client dans le processus d&apos;appel</li>
                <li>Aucun remboursement ne sera dû pendant la suspension</li>
              </ul>
            </section>

            {/* Article 12 - Force majeure */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Article 12 : Force majeure
              </h2>
              <p className="mb-3">
                <strong>12.1.</strong> Sont considérés comme cas de force majeure ou cas fortuits, les événements indépendants de la volonté des Parties, qu&apos;elles ne pouvaient raisonnablement être tenues de prévoir, et qu&apos;elles ne pouvaient raisonnablement éviter ou surmonter, dans la mesure où leur survenance rend totalement impossible l&apos;exécution des obligations. Sont notamment assimilés à des cas de force majeure ou fortuits déchargeant le Vendeur de ses obligations, les éléments suivants : les grèves de la totalité ou d&apos;une partie du personnel du NEXT LTD, l&apos;incendie, l&apos;inondation, la guerre, les arrêts de production dus à des pannes fortuites, les épidémies, catastrophes naturelles, décisions des autorités, pannes internet généralisées, décisions de WhatsApp/Meta, etc.).
              </p>
              <p className="mb-3">
                <strong>12.2.</strong> Dans de telles circonstances, NEXT LTD préviendra le Client par écrit, notamment par télécopie ou courrier électronique, dans les 24 heures de la date de survenance des événements, le Contrat liant les parties étant alors suspendu de plein droit sans indemnité, à compter de la date de survenance de l&apos;événement.
              </p>
              <p className="mb-3">
                <strong>12.3.</strong> Si l&apos;événement venait à durer plus de 180 jours à compter de la date de survenance de celui-ci, le Contrat conclu par les parties pourrait être résilié par la Partie la plus diligente, sans qu&apos;aucune des parties puisse prétendre à l&apos;octroi de dommages et intérêts.
              </p>
              <p className="mb-3">
                <strong>12.4.</strong> Cette résiliation prendra effet à la date de première présentation de la lettre recommandée avec accusé de réception dénonçant ledit Contrat.
              </p>
            </section>

            {/* Article 13 - Droit applicable et juridiction */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Article 13 : Droit applicable et juridiction
              </h2>
              <p className="mb-3">
                Les présentes conditions sont soumises au droit camerounais. Tout litige relève de la compétence exclusive des tribunaux de Douala, Cameroun, sous réserve des recours amiables préalables.
              </p>
              <p className="mb-3">
                <strong>13.1.</strong> Tout différend au sujet de l&apos;application des présentes Conditions Générales et plus généralement du Contrat, de son interprétation, de son exécution ou relatif au paiement du prix, sera porté devant le tribunal de commerce compétent du siège de NEXT LTD, quel que soit le lieu de l&apos;utilisation du service offert.
              </p>
              <p className="mb-3">
                <strong>13.2.</strong> L&apos;attribution de compétence est générale et s&apos;applique, qu&apos;il s&apos;agisse d&apos;une demande principale, d&apos;une demande incidente, d&apos;une action au fond ou d&apos;un référé.
              </p>
              <p className="mb-3">
                <strong>13.3.</strong> En outre, en cas d&apos;action judiciaire ou toute autre action en recouvrement de créances par NEXT LTD, les frais de sommation, de justice, ainsi que les honoraires d&apos;avocat et d&apos;huissier, et tous les frais annexes seront à la charge du Client fautif, ainsi que les frais liés ou découlant du non-respect par le Client des conditions de paiement ou d&apos;utilisation du service.
              </p>
              <p className="mb-3">
                <strong>13.4.</strong> En cas de litige, les parties procèderont préalablement par une tentative de conciliation qui devra débuter dès la naissance du litige. En cas d&apos;échec dans un délai de 15 jours à compter de la survenance du litige.
              </p>
            </section>

            {/* Article 14 - Médiation */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Article 14 : Médiation
              </h2>
              <p className="mb-3">
                En cas de litige, les parties s&apos;engagent à rechercher une solution amiable avant toute action judiciaire. Elles peuvent recourir à un médiateur choisi d&apos;un commun accord.
              </p>
              <p>
                Le fait pour NEXT LTD de ne pas se prévaloir à un moment donné de l&apos;une quelconque des clauses des présentes ne peut valoir renonciation à se prévaloir ultérieurement de ces mêmes clauses.
              </p>
            </section>

            {/* Article 15 - Modifications */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Article 15 : Modifications des conditions
              </h2>
              <p className="mb-3">
                NEXT LTD se réserve le droit de modifier ces conditions à tout moment. Les clients seront informés 30 jours avant l&apos;entrée en vigueur des modifications. L&apos;utilisation continue des services après cette date vaut acceptation.
              </p>
              <p>
                Toute question relative aux présentes Conditions Générales, ainsi qu&apos;aux livraisons de service qu&apos;elles régissent, qui ne serait pas traitée par les présentes stipulations contractuelles, sera régie par la loi camerounaise à l&apos;exclusion de tout autre droit.
              </p>
            </section>

            {/* Acceptation des conditions */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Acceptation des conditions
              </h2>
              <div className="border-2 border-gray-200 p-6 rounded-lg bg-gray-50">
                <p className="mb-4">
                  En cochant la case &quot;J&apos;accepte les conditions générales d&apos;utilisation&quot;
                  lors de votre inscription, vous reconnaissez :
                </p>
                <ul className="list-disc pl-6 mb-4">
                  <li>Avoir lu et compris les présentes conditions</li>
                  <li>Accepter d&apos;être lié juridiquement par ces conditions</li>
                  <li>Disposer de la capacité juridique nécessaire</li>
                  <li>Fournir des informations exactes et véridiques</li>
                </ul>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>La case à cocher vaut signature électronique au sens de la loi camerounaise</span>
                </div>
              </div>
            </section>

            {/* Contact pour questions juridiques */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Questions juridiques
              </h2>
              <div className="bg-gray-50 p-6 rounded-lg">
                <p className="mb-2">Pour toute question concernant ces conditions :</p>
                <p className="mb-2"><strong>Service NEXT LTD</strong></p>
                <p>Email : team@numericexport.com</p>
                <p>Téléphone : (+237) 696 57 81 07 / 651 01 90 69</p>
                <p>Adresse : Face Texaco Omnisport, BP 1538 Douala Cameroun</p>
              </div>
            </section>
          </div>

          {/* Pied de page */}
          <div className="mt-12 pt-6 border-t border-gray-200 flex flex-wrap justify-between items-center gap-4">
            <Link href="/" className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center">
              ← Retour à l&apos;accueil
            </Link>
            <div className="flex gap-4">
              <Link href="/privacy" className="text-gray-600 hover:text-gray-800 text-sm">
                Politique de Confidentialité
              </Link>
              <span className="text-gray-400">|</span>
              <button
                onClick={() => window.print()}
                className="text-gray-600 hover:text-gray-800 text-sm flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Version PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
