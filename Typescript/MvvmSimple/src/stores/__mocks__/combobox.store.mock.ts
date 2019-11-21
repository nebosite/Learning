const mockedResponseOptions = [
  { value: "chocolate", label: "Chocolate" },
  { value: "strawberry", label: "Strawberry" },
  { value: "vanilla", label: "Vanilla" }
];

const mockedComboboxStore: I_ComboboxStore = {
  // clone it to create a separated array
  items: [...mockedResponseOptions],
  selectedItem: null,
  query: "",

  addNewItem(val: string) {
    const lowerCasedVal = val.toLowerCase();

    // don't want to add already existed item
    if (this.isItemExisting(lowerCasedVal)) {
      return;
    }

    const newItem = {
      value: lowerCasedVal,
      label: val
    };
    this.items = [...this.items, newItem];
  },

  setQuery(query: string) {
    this.query = query;
  },

  setSelectedItem(item: ComboboxItem | null) {
    this.selectedItem = item;
  },

  isItemExisting(value: string) {
    return this.items.some((item: ComboboxItem) => item.value === value);
  }
};

export default mockedComboboxStore;
