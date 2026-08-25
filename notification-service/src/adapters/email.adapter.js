const sgMail = require("@sendgrid/mail");
const logger = require("@bidx/shared/utils/logger");
const env = require("../config/env");

class EmailAdapter {
  constructor() {
    this.mode = env.email.mode;
    if (this.mode === "live" && env.email.sendgridApiKey) {
      sgMail.setApiKey(env.email.sendgridApiKey);
      logger.info("Email adapter: SENDGRID live mode");
    } else {
      logger.info("Email adapter: DEV mode (console log only)");
    }
  }

  async send({ to, subject, html, text, templateId, dynamicData }) {
    const msg = {
      to,
      from: { email: env.email.fromAddress, name: env.email.fromName },
      subject,
      html: html || text,
      text: text || html
    };

    if (templateId) {
      msg.templateId = templateId;
      msg.dynamicTemplateData = dynamicData || {};
      delete msg.html;
      delete msg.text;
    }

    if (this.mode === "live" && env.email.sendgridApiKey) {
      try {
        const [response] = await sgMail.send(msg);
        logger.info(`Email sent to ${to} [${response.statusCode}]`);
        return { success: true, statusCode: response.statusCode, provider: "sendgrid" };
      } catch (err) {
        logger.error(`SendGrid error: ${err.message}`);
        return { success: false, error: err.message, provider: "sendgrid" };
      }
    }

    logger.info(`[DEV EMAIL] to=${to} subject=${subject}`);
    logger.info(`[DEV EMAIL] body=${(html || text || "").slice(0, 200)}`);
    return { success: true, statusCode: 200, provider: "dev" };
  }
}

module.exports = new EmailAdapter();
