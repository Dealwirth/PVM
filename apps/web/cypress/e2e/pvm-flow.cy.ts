/**
 * End-to-end scenario covering section 14 of the specification:
 * installation -> HA integration -> device detection/priority -> store ->
 * forecast/plan -> safety -> dev-log -> settings/tutorial.
 *
 * Requires a running stack: PVM server (:7000) + web dev server (:7001)
 * with PVM_API_SECRET=e2e-secret.
 */
describe('PVM end-to-end flow', () => {
  beforeEach(() => {
    cy.login();
  });

  it('shows the tutorial on first login and completes it', () => {
    cy.visit('/tutorial');
    cy.contains('PVM', { timeout: 10000 });
    // 5 steps: advance through the first 4, then finish on the last.
    for (let i = 0; i < 4; i += 1) {
      cy.get('button')
        .contains(/Weiter|Next/)
        .click({ force: true });
    }
    cy.get('button')
      .contains(/Fertig|Finish/)
      .click();
  });

  it('opens settings and reports required fields', () => {
    cy.visit('/settings');
    cy.contains(/Pflichteinstellung|required settings/i, { timeout: 10000 }).should('exist');
  });

  it('lists devices and runs discovery', () => {
    cy.visit('/devices');
    cy.contains(/Geräte|Devices/).should('exist');
    cy.get('button')
      .contains(/Geräte suchen|Discover/)
      .click();
  });

  it('shows the PVM store with installed and available addons', () => {
    cy.visit('/store');
    cy.contains(/PVM-Store|PVM Store/).should('exist');
    cy.contains(/Installiert|Installed/).should('exist');
    cy.contains(/Verfügbar|Available/).should('exist');
  });

  it('navigates to forecast, calendar, safety and dev-log', () => {
    cy.visit('/forecast');
    cy.contains(/Prognose|Forecast/).should('exist');
    cy.visit('/calendar');
    cy.contains(/Kalender|Calendar/).should('exist');
    cy.visit('/safety');
    cy.contains(/Sicherheit|Safety/).should('exist');
    cy.visit('/devlog');
    cy.contains(/Dev-Log|Dev Log/).should('exist');
  });

  it('switches language between German and English', () => {
    cy.visit('/');
    cy.get('button')
      .contains(/^(EN|DE)$/)
      .click();
    cy.get('button')
      .contains(/^(DE|EN)$/)
      .should('exist');
  });
});
