import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../store/ui.js';
import { Card } from '../components/ui.js';

const STEPS = ['step1', 'step2', 'step3', 'step4', 'step5'] as const;

export function TutorialPage(): JSX.Element {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const { completeOnboarding, setDemoMode } = useUiStore();
  const current = STEPS[step]!;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">{t('tutorial.title')}</h1>
      <Card>
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded ${i <= step ? 'bg-ha-primary' : 'bg-ha-border'}`}
            />
          ))}
        </div>
        <h2 className="mt-4 text-lg font-medium">{t(`tutorial.${current}Title`)}</h2>
        <p className="mt-2 text-sm text-gray-300">{t(`tutorial.${current}Text`)}</p>
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            className="pvm-btn-ghost"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            {t('tutorial.back')}
          </button>
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <input
              type="checkbox"
              className="accent-ha-primary"
              onChange={(e) => setDemoMode(e.target.checked)}
            />
            {t('tutorial.demo')}
          </label>
          {step < STEPS.length - 1 ? (
            <button type="button" className="pvm-btn-primary" onClick={() => setStep((s) => s + 1)}>
              {t('tutorial.next')}
            </button>
          ) : (
            <button type="button" className="pvm-btn-primary" onClick={completeOnboarding}>
              {t('tutorial.finish')}
            </button>
          )}
        </div>
        <button
          type="button"
          className="mt-2 text-xs text-gray-500 hover:text-gray-300"
          onClick={completeOnboarding}
        >
          {t('tutorial.skip')}
        </button>
      </Card>
    </div>
  );
}
