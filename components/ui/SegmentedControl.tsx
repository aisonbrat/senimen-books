import { clsx } from 'clsx'

interface Option {
  value: string
  label: string
}

interface SegmentedControlProps {
  options: Option[]
  value: string
  onChange: (value: string) => void
  fullWidth?: boolean
}

export function SegmentedControl({ options, value, onChange, fullWidth }: SegmentedControlProps) {
  return (
    <div className={clsx('flex gap-2', fullWidth && 'w-full')}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={clsx(
            'flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors border cursor-pointer outline-none',
            value === opt.value
              ? 'bg-[color:var(--accent)] text-white border-[color:var(--accent)]'
              : 'bg-white text-[#555] border-[#E8E8E6] hover:bg-[color:var(--surface-subtle)]'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
