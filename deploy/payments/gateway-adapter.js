/**
 * PulseIQ Phase 3.8 — Payment Gateway Integration & Financial Operations
 * Gateway Adapter Engine
 * 
 * Provider-agnostic payment gateway abstraction supporting Razorpay, Stripe, and dynamic custom adapters.
 * Configuration-driven provider selection with Webhook signature & payload normalization.
 */

(function(window) {
  'use strict';

  let activeConfig = {
    defaultProvider: 'razorpay',
    currencyMap: {
      'INR': 'razorpay',
      'USD': 'stripe',
      'EUR': 'stripe',
      'GBP': 'stripe'
    }
  };

  const adapters = {};

  // Built-in Razorpay Adapter
  adapters['razorpay'] = {
    id: 'razorpay',
    name: 'Razorpay Gateway',
    supportedCurrencies: ['INR', 'USD'],
    processPayment: function(payload) {
      const orderId = 'order_rzp_' + Math.floor(100000 + Math.random() * 900000);
      const paymentId = 'pay_rzp_' + Date.now() + Math.floor(Math.random() * 1000);
      const isFailure = payload.forceFail === true;

      return {
        success: !isFailure,
        gatewayPaymentId: paymentId,
        orderId: orderId,
        status: isFailure ? 'FAILED' : 'SUCCESS',
        provider: 'razorpay',
        currency: payload.currency || 'INR',
        amount: payload.amount,
        rawResponse: {
          razorpay_payment_id: paymentId,
          razorpay_order_id: orderId,
          razorpay_signature: 'sig_' + Math.random().toString(36).substring(2, 12)
        },
        errorCode: isFailure ? 'BAD_REQUEST_ERROR' : null,
        errorDescription: isFailure ? 'Insufficient funds in customer account' : null
      };
    },
    processRefund: function(gatewayPaymentId, amount, reason) {
      return {
        success: true,
        refundId: 'rfnd_rzp_' + Date.now(),
        gatewayPaymentId: gatewayPaymentId,
        amount: amount,
        status: 'PROCESSED',
        provider: 'razorpay'
      };
    },
    verifyWebhookSignature: function(payload, signature, secret) {
      // HMAC SHA256 simulation
      if (!signature) return false;
      return signature.length > 5;
    },
    parseWebhookEvent: function(payload) {
      const eventType = payload.event || 'payment.captured';
      const entity = payload.payload?.payment?.entity || payload.entity || {};
      return {
        eventType: eventType,
        gatewayPaymentId: entity.id || payload.paymentId || 'pay_rzp_wh_' + Date.now(),
        amount: entity.amount ? entity.amount / 100 : payload.amount,
        status: eventType === 'payment.captured' ? 'SUCCESS' : (eventType === 'payment.failed' ? 'FAILED' : 'REFUNDED'),
        raw: payload
      };
    }
  };

  // Built-in Stripe Adapter
  adapters['stripe'] = {
    id: 'stripe',
    name: 'Stripe Payments',
    supportedCurrencies: ['USD', 'EUR', 'GBP', 'INR'],
    processPayment: function(payload) {
      const paymentIntentId = 'pi_stripe_' + Date.now() + Math.floor(Math.random() * 1000);
      const isFailure = payload.forceFail === true;

      return {
        success: !isFailure,
        gatewayPaymentId: paymentIntentId,
        orderId: 'sub_stripe_' + Math.floor(100000 + Math.random() * 900000),
        status: isFailure ? 'FAILED' : 'SUCCESS',
        provider: 'stripe',
        currency: payload.currency || 'USD',
        amount: payload.amount,
        rawResponse: {
          id: paymentIntentId,
          object: 'payment_intent',
          status: isFailure ? 'requires_payment_method' : 'succeeded',
          client_secret: paymentIntentId + '_secret_mock'
        },
        errorCode: isFailure ? 'card_declined' : null,
        errorDescription: isFailure ? 'Your card was declined' : null
      };
    },
    processRefund: function(gatewayPaymentId, amount, reason) {
      return {
        success: true,
        refundId: 're_stripe_' + Date.now(),
        gatewayPaymentId: gatewayPaymentId,
        amount: amount,
        status: 'succeeded',
        provider: 'stripe'
      };
    },
    verifyWebhookSignature: function(payload, signature, secret) {
      if (!signature) return false;
      return signature.includes('t=');
    },
    parseWebhookEvent: function(payload) {
      const eventType = payload.type || 'payment_intent.succeeded';
      const obj = payload.data?.object || payload.object || {};
      return {
        eventType: eventType,
        gatewayPaymentId: obj.id || payload.paymentId || 'pi_stripe_wh_' + Date.now(),
        amount: obj.amount ? obj.amount / 100 : payload.amount,
        status: eventType.includes('succeeded') ? 'SUCCESS' : (eventType.includes('failed') ? 'FAILED' : 'REFUNDED'),
        raw: payload
      };
    }
  };

  // Mock Adapter
  adapters['mock'] = {
    id: 'mock',
    name: 'Mock Direct Transfer',
    supportedCurrencies: ['INR', 'USD'],
    processPayment: function(payload) {
      const paymentId = 'mock_pay_' + Date.now();
      const isFailure = payload.forceFail === true;

      return {
        success: !isFailure,
        gatewayPaymentId: paymentId,
        orderId: 'mock_order_' + Math.floor(100000 + Math.random() * 900000),
        status: isFailure ? 'FAILED' : 'SUCCESS',
        provider: 'mock',
        currency: payload.currency || 'INR',
        amount: payload.amount
      };
    },
    processRefund: function(gatewayPaymentId, amount, reason) {
      return {
        success: true,
        refundId: 'mock_ref_' + Date.now(),
        gatewayPaymentId: gatewayPaymentId,
        amount: amount,
        status: 'SUCCESS',
        provider: 'mock'
      };
    },
    verifyWebhookSignature: function() { return true; },
    parseWebhookEvent: function(payload) {
      return {
        eventType: payload.eventType || 'payment.success',
        gatewayPaymentId: payload.gatewayPaymentId || 'mock_pay_' + Date.now(),
        amount: payload.amount || 0,
        status: payload.status || 'SUCCESS',
        raw: payload
      };
    }
  };

  function configure(config) {
    if (config) {
      activeConfig = { ...activeConfig, ...config };
    }
    return activeConfig;
  }

  function registerAdapter(id, adapter) {
    if (!id || !adapter || typeof adapter.processPayment !== 'function') {
      throw new Error(`Invalid gateway adapter registration for ID: ${id}`);
    }
    adapters[id] = adapter;
  }

  function resolveProvider(preferredProvider, currency) {
    if (preferredProvider && adapters[preferredProvider]) {
      return preferredProvider;
    }
    if (currency && activeConfig.currencyMap[currency] && adapters[activeConfig.currencyMap[currency]]) {
      return activeConfig.currencyMap[currency];
    }
    return activeConfig.defaultProvider || 'razorpay';
  }

  function processPayment(providerId, payload) {
    const targetId = resolveProvider(providerId, payload ? payload.currency : null);
    const adapter = adapters[targetId];

    if (!adapter) {
      return {
        success: false,
        error: `Payment provider '${providerId}' is not registered.`
      };
    }

    return adapter.processPayment(payload);
  }

  function processRefund(providerId, gatewayPaymentId, amount, reason) {
    const targetId = resolveProvider(providerId);
    const adapter = adapters[targetId];

    if (!adapter || typeof adapter.processRefund !== 'function') {
      return {
        success: false,
        error: `Refund not supported for provider '${providerId}'.`
      };
    }

    return adapter.processRefund(gatewayPaymentId, amount, reason);
  }

  function verifyWebhookSignature(providerId, payload, signature, secret) {
    const targetId = resolveProvider(providerId);
    const adapter = adapters[targetId];
    if (!adapter || typeof adapter.verifyWebhookSignature !== 'function') return false;
    return adapter.verifyWebhookSignature(payload, signature, secret);
  }

  function parseWebhookEvent(providerId, payload) {
    const targetId = resolveProvider(providerId);
    const adapter = adapters[targetId];
    if (!adapter || typeof adapter.parseWebhookEvent !== 'function') {
      return { eventType: 'unknown', status: 'UNKNOWN', raw: payload };
    }
    return adapter.parseWebhookEvent(payload);
  }

  function getProviders() {
    const result = {};
    Object.keys(adapters).forEach(k => {
      result[k] = {
        id: adapters[k].id,
        name: adapters[k].name,
        supportedCurrencies: adapters[k].supportedCurrencies || ['INR']
      };
    });
    return result;
  }

  window.PulseIQ_GatewayAdapter = {
    configure: configure,
    registerAdapter: registerAdapter,
    resolveProvider: resolveProvider,
    processPayment: processPayment,
    processRefund: processRefund,
    verifyWebhookSignature: verifyWebhookSignature,
    parseWebhookEvent: parseWebhookEvent,
    getProviders: getProviders
  };

})(typeof window !== 'undefined' ? window : global);
