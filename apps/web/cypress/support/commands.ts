/// <reference types="cypress" />
/* eslint-disable @typescript-eslint/no-namespace -- Cypress standard typing augmentation */

declare global {
  namespace Cypress {
    interface Chainable {
      login(token?: string): Chainable<void>;
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

export {};
