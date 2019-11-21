import * as React from "react";
import { useLocalStore } from "mobx-react";

import { createStore as createComboboxStore } from "./combobox.store";
import { RootStore } from "./types";

// we don't want to fight aganist null checking and Typescript's Object is possibly 'null' violation
export const storeContext = React.createContext<RootStore>({} as RootStore);

export const StoreProvider: React.FC = ({ children }) => {
  const comboboxStore = useLocalStore(createComboboxStore);
  const rootStore: RootStore = {
    comboboxStore
  };

  return (
    <storeContext.Provider value={rootStore}>{children}</storeContext.Provider>
  );
};

export default StoreProvider;
