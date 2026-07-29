/**
 * PulseIQ Phase 2.5 — Automated Customer Follow-ups
 * Deterministic Template Engine
 * 
 * Generates structured, personalized follow-up messages using exact placeholder interpolation.
 * ZERO GENERATIVE AI. ZERO HALLUCINATIONS. 100% DETERMINISTIC TEMPLATES.
 */

(function(window) {
  'use strict';

  const TEMPLATES = {
    HighRisk: "Hello {CustomerName}, we miss seeing you at {ClubName}! Your health journey matters to us. Would you like to schedule a quick 15-minute review with Coach {CoachName}? Regards, {CoachName}.",
    Attendance: "Hi {CustomerName}, we noticed you haven't visited the wellness centre in {DaysAbsent} days. Your next session is waiting for you! Let us know when you'd like to drop in. Regards, {CoachName}.",
    Membership: "Hello {CustomerName}, your wellness membership package is expiring on {ExpiryDate}. Renew today to ensure uninterrupted access to club sessions & personalized coaching. Regards, {CoachName}.",
    BodyScan: "Hi {CustomerName}, it's time for your 14-day body composition progress scan! Tracking your progress is key to reaching your wellness goal. Let us schedule your scan this week. Regards, {CoachName}.",
    Milestone: "Congratulations {CustomerName}! 🎉 You've achieved a milestone progress of {ProgressKg} kg! Coach {CoachName} and the whole team at {ClubName} are so proud of your dedication. Keep it up!",
    Onboarding: "Welcome to {ClubName}, {CustomerName}! 🌟 We're thrilled to partner with you on your wellness journey. Coach {CoachName} is ready to assist you with your personalized meal & workout plan.",
    Birthday: "Happy Birthday {CustomerName}! 🎂 Wishing you good health, happiness, and vitality on your special day. Enjoy a special birthday gift on your next visit to {ClubName}! Best wishes, {CoachName}."
  };

  function renderTemplate(category, variables) {
    let tpl = TEMPLATES[category] || TEMPLATES.Attendance;

    const vars = {
      CustomerName: variables.CustomerName || 'Member',
      CoachName: variables.CoachName || 'your Coach',
      ClubName: variables.ClubName || 'PulseZen Wellness Center',
      DaysAbsent: variables.DaysAbsent || 'few',
      ExpiryDate: variables.ExpiryDate || 'soon',
      ProgressKg: variables.ProgressKg || '1.0'
    };

    Object.keys(vars).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      tpl = tpl.replace(regex, vars[key]);
    });

    return tpl;
  }

  window.PulseIQ_FollowupTemplateEngine = {
    renderTemplate: renderTemplate,
    getTemplates: function() { return { ...TEMPLATES }; }
  };

})(typeof window !== 'undefined' ? window : global);
