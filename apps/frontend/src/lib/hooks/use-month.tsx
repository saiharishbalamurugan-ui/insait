"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Month } from "@/lib/types";

export function useMonths() {
  return useQuery<Month[]>({
    queryKey: ["months"],
    queryFn: () => apiClient.get<Month[]>("/months"),
  });
}

export function useCreateMonth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (label?: string) => apiClient.post<Month>("/months", label ? { label } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["months"] });
    },
  });
}

export function useClearMonthData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (label: string) => apiClient.delete<{ clearedInvoices: number; clearedRosterRows: number }>(`/months/${label}/data`),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useDeleteMonth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (label: string) =>
      apiClient.delete<{ deletedInvoices: number; deletedRosterRows: number; newCurrentLabel: string | null }>(
        `/months/${label}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

interface MonthContextValue {
  selectedMonth: string | null;
  setSelectedMonth: (label: string) => void;
  currentMonthLabel: string | null;
  isViewingCurrent: boolean;
  months: Month[];
}

const MonthContext = createContext<MonthContextValue | null>(null);

export function MonthProvider({ children }: { children: React.ReactNode }) {
  const { data: months } = useMonths();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const currentMonthLabel = months?.find((m) => m.isCurrent)?.label ?? null;

  useEffect(() => {
    if (selectedMonth === null && currentMonthLabel) {
      setSelectedMonth(currentMonthLabel);
    }
  }, [currentMonthLabel, selectedMonth]);

  return (
    <MonthContext.Provider
      value={{
        selectedMonth,
        setSelectedMonth,
        currentMonthLabel,
        isViewingCurrent: selectedMonth !== null && selectedMonth === currentMonthLabel,
        months: months ?? [],
      }}
    >
      {children}
    </MonthContext.Provider>
  );
}

export function useMonthContext() {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error("useMonthContext must be used within a MonthProvider");
  return ctx;
}
