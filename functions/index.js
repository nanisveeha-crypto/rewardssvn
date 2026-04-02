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
    
    // Extract key details
    const orderId = order.id;
    const orderName = order.name; // This is the "SVN10429" style name
    const email = order.email;
    
    // Better phone extraction (Check shipping, then billing, then customer)
    const phone = (order.shipping_address && order.shipping_address.phone) || 
                  (order.billing_address && order.billing_address.phone) || 
                  (order.customer && order.customer.phone) || 
                  (order.phone) || '';

    const total = order.total_price;
    const financialStatus = order.financial_status; 
    
    // Better name extraction
    const customerName = (order.customer && (order.customer.first_name || order.customer.last_name)) ? 
                        `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : 
                        (order.billing_address ? `${order.billing_address.first_name || ''} ${order.billing_address.last_name || ''}`.trim() : 'Customer');

    logger.info(`Received order ${orderName} (${financialStatus}) from ${email}`);

    // Create/Update document in Firestore
    const docId = `${orderId}_${email.replace(/@/g, '_')}`;
    await db.collection('responses').doc(docId).set({
      order_id: orderId.toString(),
      order_name: orderName,
      email: email,
      phone: phone,
      amount: total,
      financial_status: financialStatus,
      customer_name: customerName,
      status: "Pending Q&A",
      webhook_received_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    res.status(200).send("Webhook processed successfully");
  } catch (error) {
    logger.error("Webhook Error:", error);
    res.status(500).send("Internal Server Error");
  }
});
