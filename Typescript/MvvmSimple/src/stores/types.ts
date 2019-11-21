export enum StoresEnum {
  comboboxStore = "comboboxStore"
}

export type RootStore = {
  [StoresEnum.comboboxStore]: I_ComboboxStore;
};
