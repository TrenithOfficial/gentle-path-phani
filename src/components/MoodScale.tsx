import { cn } from "@/lib/utils";

interface MoodScaleProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
}

const moodLabels = ['Very Low', 'Low', 'Okay', 'Good', 'Great'];
const energyLabels = ['Exhausted', 'Tired', 'Neutral', 'Energized', 'Vibrant'];

export const MoodScale = ({ value, onChange, label }: MoodScaleProps) => {
  const labels = label.toLowerCase().includes('energy') ? energyLabels : moodLabels;
  
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => onChange(num)}
            className={cn(
              "flex-1 h-12 rounded-lg border-2 transition-all duration-200 font-medium text-sm",
              value === num
                ? "border-primary bg-primary text-primary-foreground shadow-soft"
                : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-secondary"
            )}
          >
            {num}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground px-1">
        <span>{labels[0]}</span>
        <span>{labels[4]}</span>
      </div>
    </div>
  );
};
