// Reused from Xinmo Desktop components/FormControls.tsx; see docs/ui-reuse.md.
import { useEffect, useId, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as Select from "@radix-ui/react-select";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import { DayFlag, DayPicker, SelectionState, UI } from "react-day-picker";
import { zhCN } from "react-day-picker/locale";

const EMPTY_SELECT_VALUE = "__xinmo_empty_value__";

export interface SelectFieldOption {
  value: string;
  label: string;
  displayLabel?: string;
}

export interface SelectFieldGroup {
  label?: string;
  options: SelectFieldOption[];
}

export function SelectControl({
  value,
  groups,
  onValueChange,
  disabled = false,
  ariaLabel,
  labelledBy,
  className,
}: {
  value: string;
  groups: SelectFieldGroup[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  labelledBy?: string;
  className?: string;
}) {
  const visibleGroups = groups.filter((group) => group.options.length > 0);
  const options = visibleGroups.flatMap((group) => group.options);
  const fallbackOption = options.find((option) => option.value === "");
  const selectedOption = options.find((option) => option.value === value) ?? fallbackOption;
  const normalizedValue = options.some((option) => option.value === value) ? value : "";

  return (
    <Select.Root
      value={normalizedValue || EMPTY_SELECT_VALUE}
      disabled={disabled}
      onValueChange={(nextValue) => onValueChange(nextValue === EMPTY_SELECT_VALUE ? "" : nextValue)}
    >
      <Select.Trigger
        className={`form-control-trigger app-select__trigger ${className ?? ""}`.trim()}
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        title={selectedOption?.displayLabel ?? selectedOption?.label}
      >
        <Select.Value>{selectedOption?.displayLabel ?? selectedOption?.label}</Select.Value>
        <Select.Icon className="form-control-trigger__chevron">
          <ChevronDown size={15} aria-hidden="true" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="app-select__content"
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          onEscapeKeyDown={(event) => event.stopPropagation()}
        >
          <Select.ScrollUpButton className="app-select__scroll-button">
            <ChevronUp size={14} aria-hidden="true" />
          </Select.ScrollUpButton>
          <Select.Viewport className="app-select__viewport">
            {visibleGroups.map((group, groupIndex) => (
              <Select.Group key={`${group.label ?? "default"}-${groupIndex}`} className="app-select__group">
                {group.label && <Select.Label className="app-select__label" title={group.label}>{group.label}</Select.Label>}
                {group.options.map((option) => (
                  <Select.Item
                    key={option.value || EMPTY_SELECT_VALUE}
                    value={option.value || EMPTY_SELECT_VALUE}
                    className="app-select__item"
                    title={option.label}
                  >
                    <Select.ItemText>{option.label}</Select.ItemText>
                    <Select.ItemIndicator className="app-select__indicator">
                      <Check size={14} aria-hidden="true" />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Group>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="app-select__scroll-button">
            <ChevronDown size={14} aria-hidden="true" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export function SelectField({
  label,
  value,
  groups,
  onValueChange,
  disabled = false,
}: {
  label: string;
  value: string;
  groups: SelectFieldGroup[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
}) {
  const labelId = useId();

  return (
    <div className="editor-field">
      <span id={labelId}>{label}</span>
      <SelectControl
        value={value}
        groups={groups}
        onValueChange={onValueChange}
        disabled={disabled}
        labelledBy={labelId}
      />
    </div>
  );
}

export function DatePickerField({
  label,
  value,
  onValueChange,
  disabled = false,
  type = "date",
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  type?: "date" | "datetime-local";
}) {
  const labelId = useId();
  const withTime = type === "datetime-local";
  const selectedDate = dateValueToDate(withTime ? value.split("T")[0] : value);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(selectedDate ?? new Date());
  const [draft, setDraft] = useState(value);
  const draftDate = withTime ? dateValueToDate(draft.split("T")[0]) : selectedDate;
  const draftTime = draft.split("T")[1] || "";

  useEffect(() => {
    const nextSelectedDate = dateValueToDate(withTime ? value.split("T")[0] : value);
    if (nextSelectedDate) setMonth(nextSelectedDate);
  }, [value, withTime]);

  const selectDate = (date: Date) => {
    setMonth(date);
    if (withTime) setDraft(`${dateToDateValue(date)}T${draftTime || "00:00"}`);
    else {
      onValueChange(dateToDateValue(date));
      setOpen(false);
    }
  };
  const selectTime = (time: string) => {
    if (draftDate) setDraft(`${dateToDateValue(draftDate)}T${time}`);
  };

  return (
    <div className="editor-field">
      <span id={labelId}>{label}</span>
      <Popover.Root
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setMonth(selectedDate ?? new Date());
            setDraft(value);
          }
          setOpen(nextOpen);
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            className={`form-control-trigger date-picker__trigger ${selectedDate ? "" : "is-empty"}`}
            aria-labelledby={labelId}
            disabled={disabled}
          >
            <CalendarDays className="date-picker__icon" size={15} aria-hidden="true" />
            <span>{selectedDate ? `${formatDisplayDate(selectedDate)}${withTime ? ` ${value.split("T")[1]}` : ""}` : withTime ? "选择日期和时间" : "选择日期"}</span>
            <ChevronDown className="form-control-trigger__chevron" size={15} aria-hidden="true" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className={`date-picker__content ${withTime ? "date-time-picker__content" : ""}`}
            align="start"
            sideOffset={6}
            collisionPadding={12}
            onEscapeKeyDown={(event) => event.stopPropagation()}
          >
            <DayPicker
              mode="single"
              locale={zhCN}
              month={month}
              onMonthChange={setMonth}
              selected={draftDate}
              disabled={disabled}
              onSelect={(date) => {
                if (date) selectDate(date);
              }}
              showOutsideDays
              fixedWeeks
              classNames={{
                [UI.Root]: "date-calendar",
                [UI.Chevron]: "date-calendar__chevron",
                [UI.Months]: "date-calendar__months",
                [UI.Month]: "date-calendar__month",
                [UI.MonthCaption]: "date-calendar__caption",
                [UI.CaptionLabel]: "date-calendar__caption-label",
                [UI.Nav]: "date-calendar__nav",
                [UI.PreviousMonthButton]: "date-calendar__nav-button date-calendar__nav-button--previous",
                [UI.NextMonthButton]: "date-calendar__nav-button date-calendar__nav-button--next",
                [UI.MonthGrid]: "date-calendar__grid",
                [UI.Weekdays]: "date-calendar__weekdays",
                [UI.Weekday]: "date-calendar__weekday",
                [UI.Weeks]: "date-calendar__weeks",
                [UI.Week]: "date-calendar__week",
                [UI.Day]: "date-calendar__day",
                [UI.DayButton]: "date-calendar__day-button",
                [DayFlag.outside]: "is-outside",
                [DayFlag.today]: "is-today",
                [DayFlag.disabled]: "is-disabled",
                [DayFlag.hidden]: "is-hidden",
                [DayFlag.focused]: "is-focused",
                [SelectionState.selected]: "is-selected",
              }}
              components={{
                Chevron: ({ orientation, className }) => {
                  const Icon = orientation === "left" ? ChevronLeft : orientation === "right" ? ChevronRight : orientation === "up" ? ChevronUp : ChevronDown;
                  return <Icon className={className} size={15} aria-hidden="true" />;
                },
              }}
            />
            {withTime && <label className="date-time-picker__time" htmlFor={`${labelId}-time`}><span>时间</span><input id={`${labelId}-time`} type="time" step={60} aria-label={`${label}时间`} disabled={disabled || !draftDate} value={draftTime} onChange={event => selectTime(event.target.value)} onInput={event => selectTime(event.currentTarget.value)} /></label>}
            <div className="date-picker__actions">
              <button
                type="button"
                className="date-picker__action"
                disabled={disabled || !(withTime ? draft : value)}
                onClick={() => {
                  onValueChange("");
                  setOpen(false);
                }}
              >
                清除
              </button>
              <button type="button" className="date-picker__action is-primary" disabled={disabled} onClick={() => {
                const now = new Date();
                if (withTime) {
                  setMonth(now);
                  setDraft(`${dateToDateValue(now)}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
                } else selectDate(now);
              }}>
                {withTime ? "现在" : "今天"}
              </button>
              {withTime && <button type="button" className="date-picker__action is-primary" disabled={disabled || !draftDate || !draftTime} onClick={() => { onValueChange(draft); setOpen(false); }}>确定</button>}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

function dateValueToDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return undefined;
  return date;
}

function dateToDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
