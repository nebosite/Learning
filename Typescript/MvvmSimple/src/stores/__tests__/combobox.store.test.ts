import { createStore, responseOptions } from "../combobox.store";

describe("comboboxStore", () => {
  let store: I_ComboboxStore;

  beforeEach(() => {
    store = createStore();
  });
  it("should contain an empty initial query", () => {
    expect(store.query).toBe("");
  });

  it("should contains predefined items", () => {
    expect(store.items).toEqual(responseOptions);
  });

  it("should contain an empty selected item before any changes", () => {
    expect(store.selectedItem).toBeNull();
  });

  describe("addNewItem", () => {
    it("should create a new array with added new item", () => {
      const expectedNewItem = { value: "test", label: "Test" };
      const expectedItemsAfterUpdate = [...responseOptions, expectedNewItem];
      expect(store.items).toEqual(responseOptions);
      expect(store.items.length).toBe(3);

      store.addNewItem("Test");
      expect(store.items).not.toEqual(responseOptions);
      expect(store.items).toEqual(expectedItemsAfterUpdate);
      expect(store.items.length).toBe(4);
    });

    it("should make the value of the new item the lowercased passed arument", () => {
      const expectedNewItem = { value: "test", label: "Test" };

      store.addNewItem("Test");
      expect(store.items[3].label).toBe("Test");
      expect(store.items[3].value).toBe("test");
    });

    it("shouldn't add the item if it already exists", () => {
      // check the initial length
      expect(store.items.length).toBe(3);
      const existingItem = responseOptions[0];

      // shouldn't add the new item as it's existing
      store.addNewItem(existingItem.label);
      expect(store.items.length).toBe(3);
    });
  });

  it("setQuery should set the passed argument like a new query", () => {
    expect(store.query).toBe("");
    store.setQuery("test");
    expect(store.query).toBe("test");
  });

  it("setSelectedItem should set the passed argumet to selectedItem", () => {
    const newItem = { value: "test", label: "Test" };
    expect(store.selectedItem).toBe(null);
    store.setSelectedItem(newItem);
    expect(store.selectedItem).toEqual(newItem);
  });

  it(`isItemExisting method should return true 
		if the passed value exists in some item in items`, () => {
    const existedItemVal = responseOptions[0].value;
    expect(store.isItemExisting(existedItemVal)).toBe(true);
  });

  it(`isItemExisting mthod should return false
		if the passed value doesn't exist in some item in items`, () => {
    const nonExistedItemValue = "test";
    expect(store.isItemExisting(nonExistedItemValue)).toBe(false);
  });
});
