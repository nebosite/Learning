import * as React from "react";
import { ActionMeta, InputActionMeta, ValueType } from "react-select";
import CreatableSelect from "react-select/creatable";

// The React Select is almost impossible to test because they didn't provide any api
// and the implementation wasn't designed to be testable from outside

enum OnInputChangeEnum {
  setValue = "set-value",
  inputChange = "input-change",
  inputBlur = "input-blur",
  menuClose = "menu-close"
}

enum OnChangeEnum {
  selectOption = "select-option",
  deselectOption = "deselect-option",
  removeValue = "remove-value",
  popValue = "pop-value",
  setValue = "set-value",
  clear = "clear",
  createOption = "create-option"
}

type Props = {
  options: ComboboxItem[];
  selectedItem: ComboboxItem | null;
  onSelectValue: (selectedItem: ComboboxItem | null) => void;
  onInputChange: (val: string) => void;
  onInputEnter: VoidFn;
};

export default function Combobox(props: Props) {
  const {
    options,
    selectedItem,
    onSelectValue,
    onInputChange,
    onInputEnter
  } = props;

  const [open, setOpen] = React.useState(false);

  const show = () => {
    setOpen(true);
  };
  const hide = () => {
    setOpen(false);
  };

  const handleChange = (
    newValue: ValueType<ComboboxItem>,
    actionMeta: ActionMeta
  ) => {
    switch (actionMeta.action) {
      case OnChangeEnum.selectOption:
        onSelectValue(newValue as ComboboxItem);
        hide(); // manually hiding the combobox as we control it by ourself
        break;
      case OnChangeEnum.clear:
        onSelectValue(null);
        break;
      // could add default but it's redundant
    }
  };
  const handleInputChange = (
    inputValue: string,
    actionMeta: InputActionMeta
  ) => {
    switch (actionMeta.action) {
      case OnInputChangeEnum.inputChange:
        onInputChange(inputValue);
        break;
      case OnInputChangeEnum.setValue:
        onInputEnter();
        break;
    }
  };

  return (
    <CreatableSelect
      className="combobox"
      isClearable
      value={selectedItem}
      menuIsOpen={open}
      onMenuOpen={show}
      onBlur={hide}
      options={options}
      onChange={handleChange}
      onInputChange={handleInputChange}
    />
  );
}
