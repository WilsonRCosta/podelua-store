const nodemailer = require('nodemailer');
const { gmail, bank } = require('../config');
const { buildOrderConfirmationEmail } = require('../email/templates');

const transport = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: gmail.user, pass: gmail.appPassword },
});

async function sendOrderConfirmationEmail(order) {
  const { subject, html, text } = buildOrderConfirmationEmail(order, bank);

  await transport.sendMail({
    from: `"Pó de Lua" <${gmail.user}>`,
    to: order.customer.email,
    bcc: gmail.user,
    subject,
    html,
    text,
  });
}

module.exports = { sendOrderConfirmationEmail };
