'use client';
import { useState, useEffect } from 'react';
import { messages as messagesAPI, client } from '@/lib/api';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { FiSend, FiCheck, FiX, FiKey, FiSmartphone, FiInfo, FiAlertTriangle, FiPlus, FiTrash2, FiFileText } from 'react-icons/fi';
import Cookies from 'js-cookie';

// Interface pour les paramètres de template
interface TemplateParam {
  key: string;
  value: string;
}

export default function ApiTesterPage() {
  const [messageType, setMessageType] = useState<'text' | 'template'>('text');

  // États simplifiés
  const [recipientPhone, setRecipientPhone] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [templateName, setTemplateName] = useState('next_new_chat_v1');
  const [pdfUrl, setPdfUrl] = useState('');
  const [templateParams, setTemplateParams] = useState<TemplateParam[]>([{ key: 'name', value: '' }]);

  const [clientPhoneNumber, setClientPhoneNumber] = useState<string | null>(null);
  const [apiToken, setApiToken] = useState('');
  const [useManualToken, setUseManualToken] = useState(false);
  const [useManualPhone, setUseManualPhone] = useState(false);
  const [manualPhoneInput, setManualPhoneInput] = useState('');

  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phoneValidationError, setPhoneValidationError] = useState<string | null>(null);
  const [isValidatingPhone, setIsValidatingPhone] = useState(false);

  // Numéro émetteur effectif
  const effectivePhoneNumber = useManualPhone ? manualPhoneInput : clientPhoneNumber;

  // Gestion des paramètres dynamiques
  const addParam = () => setTemplateParams([...templateParams, { key: '', value: '' }]);
  const removeParam = (index: number) => setTemplateParams(templateParams.filter((_, i) => i !== index));
  const updateParam = (index: number, field: keyof TemplateParam, val: string) => {
    const newParams = [...templateParams];
    newParams[index][field] = val;
    setTemplateParams(newParams);
  };

  // Réinitialiser les valeurs par défaut du template quand on bascule en mode template
  useEffect(() => {
    if (messageType === 'template') {
      setTemplateName('next_new_chat_v1');
      setTemplateParams([{ key: 'name', value: '' }]);
    }
  }, [messageType]);

  // Validation du numéro de téléphone
  const isValidPhoneNumber = (phone: string | null) => {
    if (!phone) return false;
    return /^\+\d{8,15}$/.test(phone);
  };

  const validatePhoneNumber = async (phoneNumber: string) => {
    if (!phoneNumber || !isValidPhoneNumber(phoneNumber)) {
      setPhoneValidationError('Format de numéro invalide');
      return false;
    }

    setIsValidatingPhone(true);
    setPhoneValidationError(null);

    try {
      const authToken = Cookies.get('token');
      const clientId = Cookies.get('client_id');

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/whatsapp/numbers/validate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number: phoneNumber,
          client_id: clientId
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          setPhoneValidationError('Ce numéro ne vous est pas assigné');
          return false;
        }
        throw new Error(data.message || 'Erreur de validation');
      }

      setPhoneValidationError(null);
      return true;
    } catch (error) {
      console.error('❌ Erreur validation:', error);
      setPhoneValidationError('Impossible de valider le numéro');
      return false;
    } finally {
      setIsValidatingPhone(false);
    }
  };

  // Effet pour valider le numéro quand il change
  useEffect(() => {
    if (effectivePhoneNumber && useManualPhone) {
      const timeoutId = setTimeout(() => {
        validatePhoneNumber(effectivePhoneNumber);
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setPhoneValidationError(null);
    }
  }, [effectivePhoneNumber, useManualPhone]);

  // Chargement des credentials
  useEffect(() => {
    const loadClientCredentials = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log('📡 Chargement des credentials...');
        const credentialsResponse = await client.getCredentials();
        const credentials = credentialsResponse.credentials || credentialsResponse;

        // Token API
        const token = credentials?.api_token || credentials?.data?.api_token;
        if (token && typeof token === 'string' && token.startsWith('nxt_')) {
          setApiToken(token);
          setUseManualToken(false);
          console.log('✅ Token API chargé');
        } else {
          const cookieToken = Cookies.get('api_token');
          if (cookieToken?.startsWith('nxt_')) {
            setApiToken(cookieToken);
            setUseManualToken(false);
          } else {
            setUseManualToken(true);
          }
        }

        // Numéro WhatsApp
        let whatsappNumber = credentials?.whatsapp_number || credentials?.data?.whatsapp_number;

        if (whatsappNumber) {
          setClientPhoneNumber(whatsappNumber);
          setUseManualPhone(false);
          console.log('✅ Numéro WhatsApp chargé:', whatsappNumber);
        } else {
          const authToken = Cookies.get('token');
          if (authToken) {
            try {
              const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/whatsapp/my-numbers`, {
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                  'Content-Type': 'application/json',
                },
                credentials: 'include',
              });

              if (response.ok) {
                const data = await response.json();
                const number = data.data?.[0]?.phone_number || null;
                if (number) {
                  setClientPhoneNumber(number);
                  setUseManualPhone(false);
                  console.log('✅ Numéro WhatsApp chargé depuis API:', number);
                }
              }
            } catch (apiError) {
              console.log('⚠️ Échec chargement numéro');
              setUseManualPhone(true);
            }
          } else {
            setUseManualPhone(true);
          }
        }

      } catch (error) {
        console.error('❌ Erreur chargement:', error);
        setUseManualToken(true);
        setUseManualPhone(true);
        setError('Erreur de chargement des identifiants');
      } finally {
        setIsLoading(false);
      }
    };

    loadClientCredentials();
  }, []);

  // Envoi du message
  const handleSend = async () => {
    // Validations
    if (!recipientPhone.trim()) {
      alert('Veuillez entrer un numéro de destinataire');
      return;
    }

    if (!effectivePhoneNumber) {
      alert('Numéro WhatsApp émetteur manquant');
      return;
    }

    if (!isValidPhoneNumber(effectivePhoneNumber)) {
      alert('Le numéro émetteur doit être au format international (+237XXXXXXXXX)');
      return;
    }

    if (!apiToken) {
      alert('Veuillez saisir un token API valide');
      return;
    }

    // Validation renforcée du numéro émetteur
    if (useManualPhone) {
      const isAuthorized = await validatePhoneNumber(effectivePhoneNumber);
      if (!isAuthorized) {
        setResult({
          success: false,
          error: {
            message: 'Numéro émetteur non autorisé. Utilisez uniquement le numéro assigné à votre compte.',
            code: 'UNAUTHORIZED_EMITTER'
          }
        });
        return;
      }
    }

    // Validation du contenu selon le type
    if (messageType === 'text' && !messageContent.trim()) {
      alert('Veuillez entrer un message');
      return;
    }

    if (messageType === 'template' && !templateName.trim()) {
      alert('Veuillez entrer le nom du template');
      return;
    }

    setIsSending(true);
    setResult(null);

    try {
      const payload: any = {
        phoneNumber: effectivePhoneNumber,
        recipient_phone: recipientPhone.trim(),
        message_type: messageType,
      };

      if (messageType === 'text') {
        payload.message_content = messageContent.trim();
      } else {
        payload.template_name = templateName.trim();
        payload.template_language = 'fr';

        // Conversion des paramètres en objet (uniquement ceux qui ont une clé et une valeur)
        const paramsObj: Record<string, string> = {};
        templateParams.forEach(param => {
          if (param.key.trim() && param.value.trim()) {
            paramsObj[param.key.trim()] = param.value;
          }
        });

        if (Object.keys(paramsObj).length > 0) {
          payload.template_params = paramsObj;
        }

        // Gestion du PDF optionnel
        if (pdfUrl.trim()) {
          payload.invoice_data = {
            pdfUrl: pdfUrl.trim(),
            number: "001"
          };
        }
      }

      console.log('📤 Envoi message:', {
        emitter: effectivePhoneNumber,
        recipient: payload.recipient_phone,
        type: messageType,
        templateName: messageType === 'template' ? templateName : undefined,
        params: messageType === 'template' ? templateParams : undefined
      });

      const response = await messagesAPI.send(payload, apiToken);
      setResult({ success: true, data: response });
    } catch (error: any) {
      console.error('❌ Erreur envoi:', error);

      let errorMessage = error.response?.data?.message || error.message || 'Erreur réseau';
      if (errorMessage.includes('phoneNumber') || errorMessage.includes('émetteur')) {
        errorMessage = 'Numéro émetteur non valide. Veuillez utiliser le numéro WhatsApp assigné à votre compte.';
      }

      setResult({
        success: false,
        error: error.response?.data || { message: errorMessage }
      });
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-dark">Testeur API</h1>
          <p className="text-gray-500 mt-1">Chargement de votre configuration WhatsApp...</p>
        </div>
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="mt-4 text-gray-600">Récupération de votre token API et numéro WhatsApp...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark">Testeur API</h1>
        <p className="text-gray-500 mt-1">Testez l'envoi de messages WhatsApp avec votre numéro dédié</p>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800 flex items-center gap-2">
            <FiInfo className="flex-shrink-0" />
            {error}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulaire d'envoi */}
        <Card>
          <CardHeader>
            <CardTitle>📱 Envoyer un message</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {/* Section Token API */}
              <div>
                {!useManualToken && apiToken ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FiKey className="text-green-600" />
                        <span className="text-sm font-medium text-green-700">
                          Token API chargé automatiquement
                        </span>
                      </div>
                      <button
                        onClick={() => setUseManualToken(true)}
                        className="text-xs text-green-600 hover:text-green-800 underline"
                      >
                        Modifier
                      </button>
                    </div>
                    <p className="text-xs text-green-600 mt-1 font-mono break-all">
                      {apiToken.slice(0, 20)}...{apiToken.slice(-10)}
                    </p>
                  </div>
                ) : (
                  <Input
                    label="Token API (nxt_...)"
                    type="text"
                    placeholder="nxt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    icon={<FiKey />}
                    required
                  />
                )}
              </div>

              {/* Section Numéro WhatsApp Émetteur */}
              <div>
                <label className="block text-sm font-medium text-dark mb-2">
                  📞 Votre numéro WhatsApp émetteur
                  <span className="text-red-500 ml-1">*</span>
                </label>

                {!useManualPhone && clientPhoneNumber ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FiSmartphone className="text-blue-600" />
                        <span className="text-sm font-medium text-blue-700">
                          Numéro WhatsApp dédié
                        </span>
                      </div>
                      <button
                        onClick={() => setUseManualPhone(true)}
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        Saisir autre numéro
                      </button>
                    </div>
                    <div className="mt-2 p-3 bg-white rounded-lg border border-blue-100">
                      <p className="text-lg font-mono font-bold text-dark">
                        {clientPhoneNumber}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Ce numéro a été validé par Meta et vous est attribué exclusivement
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Input
                      type="text"
                      placeholder="+237699876543"
                      value={manualPhoneInput}
                      onChange={(e) => setManualPhoneInput(e.target.value)}
                      icon={<FiSmartphone />}
                      required
                      className={phoneValidationError ? 'border-red-500' : ''}
                    />

                    {phoneValidationError && (
                      <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <FiAlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                        <div>
                          <p className="text-xs font-medium text-red-800">Numéro non valide</p>
                          <p className="text-xs text-red-700">{phoneValidationError}</p>
                        </div>
                      </div>
                    )}

                    {isValidatingPhone && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <span className="animate-spin">⏳</span> Validation du numéro...
                      </p>
                    )}

                    {clientPhoneNumber && (
                      <button
                        onClick={() => {
                          setUseManualPhone(false);
                          setManualPhoneInput('');
                        }}
                        className="text-xs text-primary hover:text-primary-dark underline"
                      >
                        ← Revenir à mon numéro assigné ({clientPhoneNumber})
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Numéro destinataire */}
              <Input
                label="Numéro destinataire"
                type="text"
                placeholder="+237600000000"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                required
              />

              {/* Type de message */}
              <div>
                <label className="block text-sm font-medium text-dark mb-2">Type de message</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMessageType('text')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      messageType === 'text'
                        ? 'bg-gradient-primary text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    📝 Message texte
                  </button>
                  <button
                    onClick={() => setMessageType('template')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      messageType === 'template'
                        ? 'bg-gradient-primary text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    📋 Template (modèle)
                  </button>
                </div>
              </div>

              {/* Champs selon le type de message */}
              {messageType === 'text' ? (
                <div>
                  <label className="block text-sm font-medium text-dark mb-2">Message</label>
                  <textarea
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Entrez votre message ici..."
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <Input
                    label="Nom du template"
                    placeholder="ex: welcome_message, order_confirmation"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    helper="Template pré-rempli: next_new_chat_v1"
                  />

                  {/* Paramètres dynamiques simplifiés */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-dark">
                        Variables du message
                        <span className="text-xs text-gray-500 ml-2">
                          (Variable par défaut: name)
                        </span>
                      </label>
                      <button
                        onClick={addParam}
                        className="text-xs text-primary font-medium flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 hover:bg-primary/20 transition"
                      >
                        <FiPlus size={14} /> Ajouter une variable
                      </button>
                    </div>

                    {templateParams.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4">
                        Aucune variable. Cliquez sur "Ajouter une variable" si votre template en nécessite.
                      </p>
                    )}

                    {templateParams.map((param, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="Nom (ex: nom_client)"
                            value={param.key}
                            onChange={(e) => updateParam(index, 'key', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="Valeur (ex: Jean Dupont)"
                            value={param.value}
                            onChange={(e) => updateParam(index, 'value', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>
                        <button
                          onClick={() => removeParam(index)}
                          className="mt-1 p-2 text-red-400 hover:text-red-600 transition"
                          title="Supprimer cette variable"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    ))}
                    
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-700">
                        ℹ️ Le template "next_new_chat_v1" nécessite uniquement la variable "name"
                      </p>
                    </div>
                  </div>

                  {/* PDF optionnel */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <label className="text-sm font-medium text-dark flex items-center gap-2 mb-2">
                      <FiFileText className="text-gray-500" />
                      Joindre un PDF (optionnel)
                    </label>
                    <input
                      type="url"
                      placeholder="https://exemple.com/facture.pdf"
                      value={pdfUrl}
                      onChange={(e) => setPdfUrl(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Lien public vers votre fichier PDF
                    </p>
                  </div>
                </div>
              )}

              <Button
                onClick={handleSend}
                isLoading={isSending}
                className="w-full"
                disabled={isSending || !apiToken || !effectivePhoneNumber}
              >
                <FiSend className="mr-2" />
                Envoyer le message
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Résultat */}
        <Card>
          <CardHeader>
            <CardTitle>📊 Résultat de l'envoi</CardTitle>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-4">
                <div
                  className={`p-4 rounded-lg border ${
                    result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {result.success ? (
                      <FiCheck className="text-green-600" size={24} />
                    ) : (
                      <FiX className="text-red-600" size={24} />
                    )}
                    <span className={`font-bold ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                      {result.success ? 'Succès !' : 'Échec'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">
                    {result.success
                      ? result.data?.message || 'Message ajouté à la file d\'envoi'
                      : result.error?.message || 'Erreur inconnue'}
                  </p>
                  {result.success && result.data?.data?.queue_position && (
                    <p className="text-xs text-gray-500 mt-1">
                      Position dans la file: {result.data.data.queue_position}
                    </p>
                  )}
                </div>

                <div>
                  <h4 className="font-medium mb-2">Détails complets</h4>
                  <pre className="bg-gray-900 text-white p-4 rounded-lg text-xs overflow-auto max-h-96">
                    {JSON.stringify(result.success ? result.data : result.error, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 border-2 border-dashed rounded-xl">
                <FiSend size={48} className="mx-auto mb-4 opacity-30" />
                <p>En attente d'un envoi...</p>
                {effectivePhoneNumber && (
                  <p className="text-xs text-gray-400 mt-2">
                    Prêt à envoyer depuis le numéro: {effectivePhoneNumber}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Résumé des identifiants */}
      <Card>
        <CardHeader>
          <CardTitle>🔑 Vos identifiants API</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-1">Token API</p>
              <p className="text-sm font-mono">
                {apiToken ? (
                  <>
                    {apiToken.slice(0, 20)}...{apiToken.slice(-10)}
                    <span className="ml-2 text-xs text-green-600">✓ Chargé</span>
                  </>
                ) : (
                  <span className="text-amber-600">Non défini</span>
                )}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-1">Numéro WhatsApp émetteur</p>
              <p className="text-sm font-mono">
                {effectivePhoneNumber ? (
                  <>
                    {effectivePhoneNumber}
                    <span className="ml-2 text-xs text-green-600">✓ Chargé</span>
                  </>
                ) : (
                  <span className="text-amber-600">Non défini</span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
