'use strict';

const bcrypt = require('bcryptjs');
const { query } = require('../../config/database');

async function socadelReportingAuthRoutes(fastify) {
  fastify.post('/socadel-reporting/login', async (request, reply) => {
    const { email, password } = request.body || {};
    if (!email || !password) {
      return reply.code(400).send({
        success: false,
        message: 'email et mot de passe requis',
      });
    }

    const result = await query(
      `SELECT * FROM socadel_reporting_users WHERE LOWER(email) = LOWER($1)`,
      [String(email).trim()]
    );
    const user = result.rows[0];
    if (!user || !user.is_active) {
      return reply.code(401).send({ success: false, message: 'Identifiants incorrects' });
    }

    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) {
      return reply.code(401).send({ success: false, message: 'Identifiants incorrects' });
    }

    await query(
      `UPDATE socadel_reporting_users SET last_login_at = NOW() WHERE id = $1`,
      [user.id]
    );

    const token = fastify.jwt.sign(
      {
        role: 'socadel_reporting',
        scope: 'socadel_live',
        reportingUserId: user.id,
        email: user.email,
      },
      { expiresIn: '12h' }
    );

    return reply.send({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: 'socadel_reporting',
      },
    });
  });
}

module.exports = socadelReportingAuthRoutes;
