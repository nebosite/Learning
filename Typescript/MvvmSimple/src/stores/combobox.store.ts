// mocked response
export const responseOptions = [
  { value: "chocolate", label: "Chocolate" },
  { value: "strawberry", label: "Strawberry" },
  { value: "vanilla", label: "Vanilla" }
];

// you could add some data mappers/entities in case of complicated logic
export const createStore = () => {
  // you can add getters as well but at my opinion it's redundant in this case
  const store: I_ComboboxStore = {
    // clone it to create a separated array
    items: [...responseOptions],
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

  return store;
};
