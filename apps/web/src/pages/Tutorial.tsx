import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUiStore } from '../store/ui.js';
import { Card, PageHeader } from '../components/ui.js';

const STEPS = ['step1', 'step2', 'step3', 'step4', 'step5'] as const;

const STEP_LINK: Record<(typeof STEPS)[number], string> = {
  step1: '/settings',
  step2: '/settings',
  step3: '/devices',
  step4: '/store',
  step5: '/forecast',
};

export function TutorialPage(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const { completeOnboarding, setDemoMode, demoMode } = useUiStore();
  const current = STEPS[step]!;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={t('tutorial.title')} />

      <Card>
        <div
          className="flex gap-1"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
        >
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded ${i <= step ? 'bg-ha-primary' : 'bg-ha-border'}`}
            />
          ))}
        </div>
        <h2 className="mt-4 text-lg font-medium">{t(`tutorial.${current}Title`)}</h2>
        <p className="mt-2 text-sm text-gray-300">{t(`tutorial.${current}Text`)}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            className="pvm-btn-ghost"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            {t('tutorial.back')}
          </button>
          <button
            type="button"
            className="pvm-btn-ghost"
            onClick={() => {
              completeOnboarding();
              navigate(STEP_LINK[current]);
            }}
          >
            {t('common.details')}
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="pvm-btn-primary" onClick={() => setStep((s) => s + 1)}>
              {t('tutorial.next')}
            </button>
          ) : (
            <button
              type="button"
              className="pvm-btn-primary"
              onClick={() => {
                completeOnboarding();
                navigate('/');
              }}
            >
              {t('tutorial.finish')}
            </button>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <input
              type="checkbox"
              className="accent-ha-primary"
              checked={demoMode}
              onChange={(e) => setDemoMode(e.target.checked)}
            />
            {t('tutorial.demo')}
          </label>
          <button
            type="button"
            className="text-xs text-gray-500 hover:text-gray-300"
            onClick={completeOnboarding}
          >
            {t('tutorial.skip')}
          </button>
        </div>
      </Card>
    </div>
  );
}
