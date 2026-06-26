interface StepIndicatorProps {
  steps: number;
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-0 mb-6">
      {Array.from({ length: steps }, (_, i) => {
        const stepNum = i + 1;
        return (
          <div key={stepNum} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                currentStep >= stepNum
                  ? 'bg-accent text-white'
                  : 'bg-border text-content-muted'
              }`}
            >
              {stepNum}
            </div>
            {stepNum < steps && (
              <div
                className={`w-12 sm:w-20 h-1 transition-colors ${
                  currentStep > stepNum ? 'bg-accent' : 'bg-border'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
