// Email templates for Pó de Lua order confirmations.

function eur(n) {
    return n.toFixed(2).replace('.', ',') + ' €';
}

function orderItemsHtml(items) {
    return items
        .map(
            (it) => `
    <tr>
      <td style="padding:6px 10px; border-bottom:1px solid #e6dcc8;">${it.qty}× ${it.name}${
                it.color ? ` <span style="color:#756a5f;">(cor ${it.color})</span>` : ''
            }</td>
      <td style="padding:6px 10px; border-bottom:1px solid #e6dcc8; text-align:right;">${eur(it.price * it.qty)}</td>
    </tr>`
        )
        .join('');
}

// Builds the subject + html + text body for an order confirmation email.
// `order` shape: { reference, items, subtotal, shipping, total, customer }
// `bankDetails` shape: { iban, holder }
function buildOrderConfirmationEmail(order, bankDetails) {
    const subject = `A tua encomenda ${order.reference} — Pó de Lua`;

    const html = `
    <div style="font-family:Arial,sans-serif; color:#2a2521; max-width:520px; margin:0 auto;">
      <h2 style="font-family:Georgia,serif;">Pó de Lua 🌙</h2>
      <p>Olá ${order.customer.name},</p>
      <p>Obrigado pela tua encomenda! Falta só o pagamento por transferência bancária para a confirmarmos:</p>
      <table style="background:#f7f2ea; border-radius:10px; width:100%; border-collapse:collapse; margin:16px 0;">
        <tr><td style="padding:8px 14px;"><strong>IBAN</strong></td><td style="padding:8px 14px;">${bankDetails.iban}</td></tr>
        <tr><td style="padding:8px 14px;"><strong>Titular</strong></td><td style="padding:8px 14px;">${bankDetails.holder}</td></tr>
        <tr><td style="padding:8px 14px;"><strong>Referência</strong></td><td style="padding:8px 14px;"><strong>${order.reference}</strong></td></tr>
        <tr><td style="padding:8px 14px;"><strong>Valor a pagar</strong></td><td style="padding:8px 14px;"><strong>${eur(order.total)}</strong></td></tr>
      </table>
      <p style="font-size:0.85rem; color:#756a5f;">Importante: usa <strong>${order.reference}</strong> como descritivo da transferência, para identificarmos o teu pagamento.</p>
      <h3 style="margin-top:28px;">Resumo</h3>
      <table style="width:100%; border-collapse:collapse;">${orderItemsHtml(order.items)}</table>
      <p style="margin-top:16px;">Subtotal: ${eur(order.subtotal)}<br>Envio: ${eur(order.shipping)}<br><strong>Total: ${eur(order.total)}</strong></p>
      <p style="margin-top:20px;">Assim que confirmarmos o pagamento, preparamos o envio para:<br>${order.customer.address}</p>
      <p>Qualquer dúvida, responde a este email.</p>
      <p>Com carinho,<br>Pó de Lua</p>
    </div>
  `;

    const text = `Encomenda ${order.reference}

IBAN: ${bankDetails.iban}
Titular: ${bankDetails.holder}
Referência: ${order.reference}
Valor: ${eur(order.total)}

Usa a referência como descritivo da transferência.`;

    return { subject, html, text };
}

module.exports = { buildOrderConfirmationEmail };