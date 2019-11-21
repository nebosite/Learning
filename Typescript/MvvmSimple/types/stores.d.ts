
interface I_ComboboxStore {
	selectedItem: ComboboxItem | null;

	// items for our combobox
	items: ComboboxItem[];
	
	// the current combobox search query
	query: string;

	setQuery(query: string): void;
	addNewItem(value: string): void;
	setSelectedItem(item: ComboboxItem | null): void;

	isItemExisting(value: string): boolean; 
 
}