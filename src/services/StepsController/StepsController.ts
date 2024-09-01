import { makeObservable, observable, action, computed } from "mobx";
import { StepTypes } from "./types";

class StepsController {
  static STEPS: StepTypes[] = ["serial_connect", "wifi", "flashing"];
  activeStep: StepTypes = "serial_connect";
  stepCompletionStatus: Record<StepTypes, boolean> = {
    serial_connect: false,
    wifi: false,
    flashing: false,
  };
  _canGoBack: boolean = false;
  _canGoNext: boolean = false;

  constructor() {
    makeObservable(this, {
      activeStep: observable,
      stepCompletionStatus: observable,
      _canGoBack: observable,
      _canGoNext: observable,
      canGoNext: computed,
      canGoBack: computed,
      goNext: action,
      goBack: action,
      setCanGoBack: action,
      setCanGoNext: action,
      setStepCompleted: action,
    });
  }


  get canGoBack() {
    return this._canGoBack && StepsController.STEPS.indexOf(this.activeStep) > 0;
  }

  get canGoNext() {
    return this._canGoNext && StepsController.STEPS.indexOf(this.activeStep) < StepsController.STEPS.length - 1;
  }

  goNext = () => {
    const newStepIndex = StepsController.STEPS.indexOf(this.activeStep) + 1;
    if (newStepIndex < StepsController.STEPS.length) {
      this.activeStep = StepsController.STEPS[newStepIndex];
    }
  }

  goBack = () => {
    const newStepIndex = StepsController.STEPS.indexOf(this.activeStep) - 1;
    if (newStepIndex >= 0) {
      this.activeStep = StepsController.STEPS[newStepIndex];
    }
  }

  setCanGoBack = (canGoBack: boolean) => {
    this._canGoBack = canGoBack;
  }

  setCanGoNext = (canGoNext: boolean) => {
    this._canGoNext = canGoNext;
  }

  setStepCompleted = (completed: boolean) => {
    this.stepCompletionStatus[this.activeStep] = completed;
  }

  isCompleted = (step: StepTypes) => {
    return this.stepCompletionStatus[step];
  }
}

export const stepsController = new StepsController();

