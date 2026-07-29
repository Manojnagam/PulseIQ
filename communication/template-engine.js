/**
 * PulseIQ Phase 3.3 — Notification & Communication Hub
 * Template Engine
 * 
 * Manages deterministic message templates across In-App, WhatsApp, SMS, and Email channels.
 */

(function(window) {
  'use strict';

  const TEMPLATES = {
    RENEWAL_ALERT: {
      in_app: "Membership pack for {{customerName}} expires in {{daysLeft}} days on {{expiryDate}}.",
      whatsapp: "Namaste {{customerName}}! 🌿 Your membership at {{centerName}} is expiring on {{expiryDate}}. Renew today to keep your fitness streak active!",
      sms: "PulseZen Alert: Hi {{customerName}}, your membership expires on {{expiryDate}}. Renew now at {{centerName}}.",
      email: "Subject: Membership Expiry Reminder - {{centerName}}\n\nDear {{customerName}},\n\nYour membership pack will expire on {{expiryDate}}. Please visit {{centerName}} or contact your coach to renew."
    },
    RISK_OUTREACH: {
      in_app: "High retention risk alert for {{customerName}} (Absent {{daysAbsent}} days).",
      whatsapp: "Hi {{customerName}}, we missed you at {{centerName}}! 🌿 Your coach is checking in to help you stay on track with your health goals. When can we expect you?",
      sms: "We miss you at {{centerName}}! Contact your coach today to schedule your next wellness visit.",
      email: "Subject: We Miss You at {{centerName}}!\n\nDear {{customerName}},\n\nWe noticed you haven't checked in for {{daysAbsent}} days. Your health progress is important to us!"
    },
    BODY_SCAN_REMINDER: {
      in_app: "14-Day Karada Body Scan due for {{customerName}}.",
      whatsapp: "Hi {{customerName}}! It's time for your bi-weekly body composition review at {{centerName}} ⚖️. Book your scan with your coach today!",
      sms: "PulseZen Body Scan: Hi {{customerName}}, your 14-day progress scan is due at {{centerName}}.",
      email: "Subject: Time for Your Bi-Weekly Body Scan!\n\nDear {{customerName}},\n\nYour 14-day body composition scan is due at {{centerName}}."
    },
    ACTION_TASK: {
      in_app: "Urgent Task: {{taskTitle}} - {{taskReason}}",
      whatsapp: "Urgent Operational Alert: {{taskTitle}}. {{taskReason}}.",
      sms: "PulseZen Task: {{taskTitle}}. Please address immediately.",
      email: "Subject: Operational Task Alert - {{taskTitle}}\n\nDetails: {{taskReason}}"
    }
  };

  function renderTemplate(category, channel, data) {
    const catTemplates = TEMPLATES[category] || TEMPLATES.ACTION_TASK;
    let templateStr = catTemplates[channel] || catTemplates.in_app || '';

    Object.keys(data || {}).forEach(key => {
      const regex = new RegExp('{{\\s*' + key + '\\s*}}', 'g');
      templateStr = templateStr.replace(regex, data[key]);
    });

    return templateStr;
  }

  window.PulseIQ_CommTemplateEngine = {
    renderTemplate: renderTemplate,
    getTemplates: function() { return JSON.parse(JSON.stringify(TEMPLATES)); }
  };

})(typeof window !== 'undefined' ? window : global);
