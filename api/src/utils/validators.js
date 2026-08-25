const Joi = require('joi');

// Schémas de validation

const registerClientSchema = Joi.object({
  company_name: Joi.string().min(2).max(255),
  company_type: Joi.string().valid('entreprise', 'personnel').required(),
  email: Joi.string().email().required(),
  phone: Joi.string().min(8).max(50),
  address: Joi.string().max(500),
  city: Joi.string().max(100),
  country: Joi.string().max(100).default('Cameroun'),
  tax_id: Joi.string().max(100),
  password: Joi.string().min(8).required()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .messages({
      'string.pattern.base': 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial'
    }),
  confirm_password: Joi.string().valid(Joi.ref('password')).required()
    .messages({ 'any.only': 'Les mots de passe ne correspondent pas' })
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  remember_me: Joi.boolean().default(false)
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  user_type: Joi.string().valid('client', 'user').default('client')
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).required()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .messages({
      'string.pattern.base': 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial'
    }),
  confirm_password: Joi.string().valid(Joi.ref('password')).required()
    .messages({ 'any.only': 'Les mots de passe ne correspondent pas' })
});

const registerUserSchema = Joi.object({
  email: Joi.string().email().required(),
  full_name: Joi.string().min(2).max(255).required(),
  role: Joi.string().valid('admin', 'secretaire', 'commercial', 'auditeur', 'responsable_achat', 'responsable_financier').required(),
  permissions: Joi.array().items(Joi.string()).default([]),
  password: Joi.string().min(8).required()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
});

const createInvitationSchema = Joi.object({
  role: Joi.string().valid('secretaire', 'commercial', 'auditeur', 'responsable_achat', 'responsable_financier').required(),
  permissions: Joi.array().items(Joi.string()).default([]),
  max_uses: Joi.number().integer().min(1).default(1),
  expires_in_days: Joi.number().integer().min(1).max(7).default(3)
});

const sendMessageSchema = Joi.object({
  phoneNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
  recipient_phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required()
    .messages({ 'string.pattern.base': 'Numéro de téléphone invalide (format: +237XXXXXXXXX)' }),
  message_type: Joi.string().valid('text', 'template', 'media').required(),
  template_name: Joi.string().when('message_type', {
    is: 'template',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  template_language: Joi.string().default('fr'),
 // template_params: Joi.array().items(Joi.string()).when('message_type', {
   template_params: Joi.object().unknown().when('message_type', { 
   is: 'template',
    then: Joi.optional(),
    otherwise: Joi.forbidden()
  }),
  message_content: Joi.string().when('message_type', {
    is: 'text',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  media_url: Joi.string().uri().when('message_type', {
    is: 'media',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  // Ajouter ceci pour accepter les données de facturation/PDF
  invoice_data: Joi.object({
    pdfUrl: Joi.string().uri().required(),
    number: Joi.string().optional()
  }).optional()
});

const createOrderSchema = Joi.object({
  quantity: Joi.number().integer().min(1).required()
    .messages({ 'number.min': 'La quantité doit être au minimum 1' })
});

// Fonction de validation
function validate(schema, data) {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    throw {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Erreur de validation',
      errors
    };
  }

  return value;
}

module.exports = {
  validate,
  schemas: {
    registerClientSchema,
    loginSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    registerUserSchema,
    createInvitationSchema,
    sendMessageSchema,
    createOrderSchema
  }
};
