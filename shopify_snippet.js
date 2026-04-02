{% if first_time_accessed %}
<!-- SVNTEX Reward System - Liquid Integration -->
<div id="svntex-qa-reward" style="
  margin: 20px 0;
  padding: 24px;
  background: linear-gradient(135deg, #6e8efb, #a777e3);
  color: white;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
">
  <h2 style="margin: 0 0 10px; font-size: 22px; color: white !important;">🎁 Get Your Reward!</h2>
  <p style="margin: 0 0 20px; font-size: 16px; opacity: 0.9;">Answer a few quick questions about your experience and unlock a special discount code for your next purchase.</p>
  
  {% capture qa_url %}https://master-49709.web.app/qa?order_id={{ order.id }}&order_name={{ order.name | url_encode }}&email={{ order.email | url_encode }}&phone={{ order.shipping_address.phone | url_encode }}&amount={{ order.total_price | money_without_currency }}{% endcapture %}
  
  <a href="{{ qa_url }}" style="
    display: inline-block;
    padding: 12px 30px;
    background-color: white;
    color: #6e8efb !important;
    text-decoration: none;
    border-radius: 8px;
    font-weight: bold;
  ">
    Answer Now & Claim Reward
  </a>
</div>
{% endif %}
