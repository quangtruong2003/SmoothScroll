import type { OnboardingUseCase, OnboardingFeel } from "@/lib/tauri";

export type WizardStep = 1 | 2 | 3;

export interface WizardState {
  step: WizardStep;
  useCase: OnboardingUseCase | null;
  feel: OnboardingFeel | null;
}

export type WizardAction =
  | { type: "set_use_case"; value: OnboardingUseCase }
  | { type: "set_feel"; value: OnboardingFeel }
  | { type: "next" }
  | { type: "back" }
  | { type: "reset" };

export const initialWizardState: WizardState = {
  step: 1,
  useCase: null,
  feel: null,
};

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "set_use_case":
      return { ...state, useCase: action.value };
    case "set_feel":
      return { ...state, feel: action.value };
    case "next":
      if (state.step === 1 && state.useCase) return { ...state, step: 2 };
      if (state.step === 2 && state.feel) return { ...state, step: 3 };
      return state;
    case "back":
      if (state.step === 3) return { ...state, step: 2 };
      if (state.step === 2) return { ...state, step: 1 };
      return state;
    case "reset":
      return initialWizardState;
  }
}
