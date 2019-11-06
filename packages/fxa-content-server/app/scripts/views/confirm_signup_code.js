/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import _ from 'underscore';
import AuthErrors from '../lib/auth-errors';
import Cocktail from 'cocktail';
import FlowEventsMixin from './mixins/flow-events-mixin';
import FormView from './form';
import ServiceMixin from './mixins/service-mixin';
import Template from 'templates/confirm_signup_code.mustache';
import ResendMixin from './mixins/resend-mixin';

const CODE_INPUT_SELECTOR = 'input.otp-code';

const proto = FormView.prototype;

class ConfirmSignupCodeView extends FormView {
  template = Template;
  className = 'confirm-signup-code';

  afterVisible() {
    // the view is always rendered, but the confirmation may be
    // prevented by the broker.
    const account = this.getAccount();
    return proto.afterVisible
      .call(this)
      .then(() => this.broker.persistVerificationData(account))
      .then(() =>
        this.invokeBrokerMethod('beforeSignUpConfirmationPoll', account)
      );
  }

  getAccount() {
    return this.model.get('account');
  }

  setInitialContext(context) {
    const email = this.getAccount().get('email');

    context.set({
      email,
      escapedEmail: `<span class="email">${_.escape(email)}</span>`,
    });
  }

  beforeRender() {
    // User cannot confirm if they have not initiated a sign up.
    if (! this.getAccount()) {
      this.navigate('signup');
    }
  }

  resend() {
    const account = this.getAccount();
    return account.verifySessionResendCode();
  }

  submit() {
    const account = this.getAccount();
    const code = this.getElementValue(CODE_INPUT_SELECTOR);
    const newsletters = account.get('newsletters');
    const options = {
      service: this.relier.get('service') || null,
    };
    return account
      .verifySessionCode(code, options)
      .then(() => {
        this.logViewEvent('verification.success');
        this.notifier.trigger('verification.success');
        if (newsletters) {
          this.notifier.trigger('flow.event', {
            event: 'newsletter.subscribed',
          });
        }

        return this.invokeBrokerMethod('afterSignUpConfirmationPoll', account);
      })
      .catch(err => {
        if (
          AuthErrors.is(err, 'INVALID_EXPIRED_SIGNUP_CODE') ||
          AuthErrors.is(err, 'OTP_CODE_REQUIRED') ||
          AuthErrors.is(err, 'INVALID_OTP_CODE')
        ) {
          return this.showValidationError(this.$(CODE_INPUT_SELECTOR), err);
        }
        // Throw all other errors, these will be displayed in the .error div and not
        // tooltip.
        throw err;
      });
  }
}

Cocktail.mixin(
  ConfirmSignupCodeView,
  FlowEventsMixin,
  ResendMixin(),
  ServiceMixin
);

export default ConfirmSignupCodeView;
