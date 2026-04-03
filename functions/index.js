/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

/**
 * Shopify Webhook Listener
 * Receives order data when a new order is paid/created.
 */
exports.shopifyWebhook = onRequest(async (req, res) => {
  // 1. Basic check for POST
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const order = req.body;
    logger.info("FULL SHOPIFY ORDER:", JSON.stringify(order));
    
    // 2. Extra Robust Extraction
    const shopifyId = (order.id || '').toString();
    const orderName = (order.name || '').trim(); 
    const orderNumber = (order.order_number || '').toString();
    
    // Check top-level email, then customer email
    const email = (order.email || (order.customer && order.customer.email) || '').toLowerCase().trim();
    
    // EXHAUSTIVE Phone Extraction
    const phone = (order.shipping_address && order.shipping_address.phone) || 
                  (order.billing_address && order.billing_address.phone) || 
                  (order.customer && order.customer.phone) || 
                  (order.phone) || 
                  (order.customer && order.customer.default_address && order.customer.default_address.phone) || '';

    // Robust Total Extraction
    const total = order.total_price || order.current_total_price || (order.total_price_set && order.total_price_set.shop_money && order.total_price_set.shop_money.amount) || '0.00';
    const financialStatus = order.financial_status || 'Pending'; 
    
    // Better name extraction (Check customer, then addresses)
    let customerName = 'Customer';
    if (order.customer && (order.customer.first_name || order.customer.last_name)) {
        customerName = `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim();
    } else if (order.billing_address) {
        customerName = `${order.billing_address.first_name || ''} ${order.billing_address.last_name || ''}`.trim();
    } else if (order.shipping_address) {
        customerName = `${order.shipping_address.first_name || ''} ${order.shipping_address.last_name || ''}`.trim();
    }

    logger.info(`Received order ${orderName} (${financialStatus}) from ${email} (Customer: ${customerName})`);

    const checkoutToken = (order.checkout_token || '').trim();

    // Debug: Save FULL payload to webhook_logs collection
    await db.collection('webhook_logs').add({
        order_id: shopifyId,
        order_name: orderName,
        email: email,
        payload: order,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    // Primary Strategy: Use the unique Shopify Order ID as the document name.
    const targetDocId = shopifyId;
    logger.info(`Processing order ${orderName} into document: ${targetDocId}`);

    // Merge Shopify data into the document
    await db.collection('responses').doc(targetDocId).set({
      order_id: shopifyId,
      order_name: orderName,
      order_number: orderNumber,
      checkout_token: checkoutToken,
      email: email,
      phone: phone,
      amount: total,
      financial_status: financialStatus,
      customer_name: customerName,
      status: "Pending Q&A",
      webhook_received_at: admin.firestore.FieldValue.serverTimestamp(),
      last_updated_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    res.status(200).send("Webhook processed successfully");
  } catch (error) {
    logger.error("Webhook Error:", error);
    res.status(500).send("Internal Server Error");
  }
});
