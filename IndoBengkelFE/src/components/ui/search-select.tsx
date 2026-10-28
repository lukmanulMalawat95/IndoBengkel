"use client";

import * as React from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchSelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface SearchSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchSelectOption[];
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  inputClassName?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  ariaLabel?: string;
  ariaDescribedBy?: string;
  clearLabel?: string;
  allowClear?: boolean;
  maxResults?: number;
}

/**
 * A typeable single-select combobox. The input stays editable while the
 * options below narrow to the typed text. Keyboard support: ArrowUp/Down,
 * Enter, Escape, and Tab.
 */
export function SearchSelect({
  value,
  onChange,
  options,
  placeholder,
  emptyMessage = "No options.",
  disabled = false,
  id,
  name,
  className,
  inputClassName,
  inputMode,
  ariaLabel,
  ariaDescribedBy,
  clearLabel = "Clear selection",
  allowClear = true,
  maxResults = 60,
}: SearchSelectProps) {
  const listId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(-1);

  const selected = React.useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );
  const selectedLabel = selected?.label ?? value;

  React.useEffect(() => {
    if (!open) setQuery(selectedLabel);
  }, [open, selectedLabel]);

  React.useEffect(() => {
    if (open && !value) setQuery("");
  }, [open, value]);

  const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
  const normalizedSelected = selectedLabel.trim().toLocaleLowerCase("id-ID");
  const filter = normalizedQuery && normalizedQuery !== normalizedSelected ? normalizedQuery : "";

  const filtered = React.useMemo(() => {
    if (!filter) return options.slice(0, maxResults);
    return options
      .filter((option) =>
        `${option.label} ${option.value} ${option.description ?? ""}`
          .toLocaleLowerCase("id-ID")
          .includes(filter),
      )
      .slice(0, maxResults);
  }, [filter, maxResults, options]);

  React.useEffect(() => {
    if (!open) {
      setActiveIndex(-1);
      return;
    }
    const selectedIndex = filtered.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : filtered.length > 0 ? 0 : -1);
  }, [filtered, open, value]);

  const openList = () => {
    if (disabled) return;
    setOpen(true);
  };

  const select = (option: SearchSelectOption) => {
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
    inputRef.current?.focus();
  };

  const clear = () => {
    onChange("");
    setQuery("");
    setActiveIndex(-1);
    setOpen(false);
    inputRef.current?.focus();
  };

  const exactMatch = () => {
    const target = query.trim().toLocaleLowerCase("id-ID");
    if (!target) return undefined;
    return options.find(
      (option) =>
        option.label.trim().toLocaleLowerCase("id-ID") === target ||
        option.value.trim().toLocaleLowerCase("id-ID") === target,
    );
  };

  const commitExactMatch = () => {
    const match = exactMatch();
    if (match) {
      onChange(match.value);
      setQuery(match.label);
      return true;
    }
    return false;
  };

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    if (!next || !event.currentTarget.contains(next)) {
      setOpen(false);
      if (!commitExactMatch()) setQuery(selectedLabel);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      setActiveIndex((current) =>
        filtered.length === 0 ? -1 : Math.min(current + 1, filtered.length - 1),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      setActiveIndex((current) => (filtered.length === 0 ? -1 : Math.max(current - 1, 0)));
      return;
    }

    if (event.key === "Enter") {
      if (open) {
        const option = exactMatch() ?? (activeIndex >= 0 ? filtered[activeIndex] : undefined);
        if (option) {
          event.preventDefault();
          select(option);
        }
      }
      return;
    }

    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
        setQuery(selectedLabel);
      }
      return;
    }

    if (event.key === "Tab") {
      setOpen(false);
      if (!commitExactMatch()) setQuery(selectedLabel);
    }
  };

  const activeOption = open && activeIndex >= 0 ? filtered[activeIndex] : undefined;

  return (
    <div className={cn("relative", className)} onBlur={handleBlur}>
      <input
        ref={inputRef}
        id={id}
        name={name}
        role="combobox"
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-expanded={open}
        aria-controls={`${listId}-listbox`}
        aria-autocomplete="list"
        aria-activedescendant={
          activeOption ? `${listId}-option-${activeIndex}` : undefined
        }
        autoComplete="off"
        disabled={disabled}
        inputMode={inputMode}
        value={query}
        placeholder={placeholder}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onClick={openList}
        onFocus={openList}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex h-10 w-full rounded-input border border-line bg-surface px-3 py-2 text-sm text-fg placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50",
          allowClear && value ? "pr-14" : "pr-9",
          inputClassName,
        )}
      />

      {allowClear && value && !disabled ? (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={clear}
          className="absolute right-8 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-faint hover:bg-surface2 hover:text-fg"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}

      <ChevronDown
        className={cn(
          "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint transition-transform",
          open && "rotate-180",
        )}
      />

      {open && !disabled ? (
        <div
          id={`${listId}-listbox`}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-input border border-line bg-surface p-1 shadow-xl"
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted">{emptyMessage}</p>
          ) : (
            filtered.map((option, index) => {
              const isActive = index === activeIndex;
              const isSelected = option.value === value;
              return (
                <div
                  key={`${option.value}-${index}`}
                  id={`${listId}-option-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => select(option)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    "cursor-pointer rounded-md px-3 py-2 text-sm",
                    isActive ? "bg-accent/10 text-fg" : "text-muted",
                    isSelected && "font-medium text-fg",
                  )}
                >
                  <span className="block truncate">{option.label}</span>
                  {option.description ? (
                    <span className="mt-0.5 block truncate text-[11px] text-faint">
                      {option.description}
                    </span>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
