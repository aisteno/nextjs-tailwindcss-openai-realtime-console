import { useState, useEffect, useRef } from 'react';

export function Toggle({
  defaultValue = false,
  values,
  labels,
  onChange = () => void 0,
}: {
  defaultValue?: string | boolean;
  values?: string[];
  labels?: string[];
  onChange?: (isEnabled: boolean, value: string) => void;
}) {
  if (typeof defaultValue === 'string') {
    defaultValue = !!Math.max(0, (values ?? []).indexOf(defaultValue));
  }

  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState<boolean>(defaultValue);

  const toggleValue = () => {
    const v = !value;
    const index = +v;
    setValue(v);
    onChange(v, (values ?? ['false', 'true'])[index] ?? 'false');
  };

  useEffect(() => {
    const leftEl = leftRef.current;
    const rightEl = rightRef.current;
    const bgEl = bgRef.current;
    if (leftEl && rightEl && bgEl) {
      if (value) {
        bgEl.style.left = rightEl.offsetLeft + 'px';
        bgEl.style.width = rightEl.offsetWidth + 'px';
      } else {
        bgEl.style.left = '';
        bgEl.style.width = leftEl.offsetWidth + 'px';
      }
    }
  }, [value]);

  return (
    <div
      onClick={toggleValue}
      className="relative text-xs flex items-center gap-2 cursor-pointer overflow-hidden bg-gray-100 hover:bg-gray-200 text-gray-900 h-10 rounded-full"
      data-enabled={value.toString()}
    >
      {labels && (
        <div
          ref={leftRef}
          className={`relative px-4 z-10 select-none transition-colors duration-100 ${value ? 'text-gray-500' : 'text-white'
            }`}
        >
          {labels[0]}
        </div>
      )}
      {labels && (
        <div
          ref={rightRef}
          className={`relative px-4 -ml-2 z-10 select-none transition-colors duration-100 ${value ? 'text-white' : 'text-gray-500'
            }`}
        >
          {labels[1]}
        </div>
      )}
      <div
        ref={bgRef}
        className="absolute top-0 left-0 bottom-0 bg-gray-900 z-0 rounded-full transition-all duration-100"
      />
    </div>
  );
}
