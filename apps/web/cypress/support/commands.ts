/// <reference types="cypress" />
/* eslint-disable @typescript-eslint/no-namespace -- Cypress standard typing augmentation */

declare global {
  namespace Cypress {
    interface Chainable {
      login(token?: string): Chainable<void>;
      dismissSetup(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('login', (token?: string) => {
  cy.request({
    method: 'POST',
    url: '/api/auth/login',
    body: { token: token ?? Cypress.env('PVM_API_SECRET') },
    failOnStatusCode: false,
  }).then((res) => {
    if (res.body?.token) {
      window.localStorage.setItem('pvm.token', res.body.token);
    }
  });
});

// The E2E scenarios describe an already-configured instance; dismiss the
// first-run setup assistant so the page navigation is not blocked by it.
Cypress.Commands.add('dismissSetup', () => {
  cy.request({
    method: 'POST',
    url: '/api/auth/login',
    body: { token: Cypress.env('PVM_API_SECRET') },
    failOnStatusCode: false,
  }).then((login) => {
    if (!login.body?.token) return;
    cy.request({
      method: 'PUT',
      url: '/api/settings',
      headers: { Authorization: `Bearer ${login.body.token}` },
      body: { general: { setupDismissed: true } },
      failOnStatusCode: false,
    });
  });
});

export {};
