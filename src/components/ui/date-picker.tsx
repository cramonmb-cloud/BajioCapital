"use client"

import * as React from "react"
import { format } from "date-fns"
import { es } from 'date-fns/locale'
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  date: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
  className?: string;
  variant?: "outline" | "ghost" | "secondary" | "default";
}

export function DatePicker({ date, onDateChange, className, variant = "outline" }: DatePickerProps) {

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={variant}
            className={cn(
              "w-full justify-start text-left font-normal text-xs h-9",
              !date && "text-muted-foreground",
              variant === "ghost" && "border-none bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-none px-2"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-zinc-400" />
            <span className="truncate">
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, "dd/MM/yyyy", { locale: es })} -{" "}
                    {format(date.to, "dd/MM/yyyy", { locale: es })}
                  </>
                ) : (
                  format(date.from, "dd/MM/yyyy", { locale: es })
                )
              ) : (
                <span>Rango de fechas</span>
              )}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={onDateChange}
            numberOfMonths={2}
            locale={es}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
