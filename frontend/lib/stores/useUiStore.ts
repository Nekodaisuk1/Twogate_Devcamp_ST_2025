
import { create } from "zustand";
import type { DatePref, Note } from "@/lib/types";

type State = {
  search: string;
  datePref: DatePref;
  graphResults: Note[];
  focusNoteId?: number;
  collapsed: Record<string, boolean>;
};

type Actions = {
  setSearch: (v: string) => void;
  setDatePref: (v: DatePref) => void;
  setGraphResults: (notes: Note[]) => void;
  setFocus: (id?: number) => void;
  toggleSection: (key: string) => void;
};

const initial: State = {
  search: "",
  datePref: (typeof window !== "undefined" && (localStorage.getItem("datePref") as DatePref)) || "updated",
  graphResults: [],
  focusNoteId: undefined,
  collapsed: {},
};

export const useUiStore = create<State & Actions>((set, get) => ({
  ...initial,
  setSearch: (v) => set({ search: v }),
  setDatePref: (v) => {
    if (typeof window !== "undefined") localStorage.setItem("datePref", v);
    set({ datePref: v });
  },
  setGraphResults: (notes) => set({ graphResults: notes }),
  setFocus: (id) => set({ focusNoteId: id }),
  toggleSection: (key) => {
    const cur = get().collapsed[key];
    set({ collapsed: { ...get().collapsed, [key]: !cur } });
  },
}));
