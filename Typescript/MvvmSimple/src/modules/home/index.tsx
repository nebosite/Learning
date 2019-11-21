import * as React from "react";

import { observer } from "mobx-react";
import { storeContext } from "stores";

// separated import is also possible
// import { useMousePosition } from "shared/hooks";
import { useMousePosition, TextInpRealLn, Combobox } from "shared";

// This component could be separated for the smaller ones but it's a bit redundant
function Home() {
  const rootStore = React.useContext(storeContext);
  const mousePosiotion = useMousePosition();

  const { comboboxStore } = rootStore;
  const { query, items, selectedItem } = comboboxStore;

  return (
    <div className="home">
      <h2 className="page-title">Home</h2>

      <div className="container">
        <div className="row">
          <div className="col-6">
            <div className="st-container">
              <h5>Mouse position</h5>
              Mouse position:{" "}
              <b className="attention-msg">
                {mousePosiotion.x} : {mousePosiotion.y}
              </b>
            </div>
          </div>
          <div className="col-6">
            <div className="st-container">
              <h5>Text Input length life-track</h5>
              <TextInpRealLn />
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-12">
            <div className="alert alert-primary query-row">
              <span>Combobox saved query: </span>
              <b className="attention-msg">{query}</b>
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-12">
            <div className="alert alert-primary query-row">
              <span>Selected Combobox Item:</span>
              {selectedItem && (
                <b className="attention-msg">{selectedItem.label}</b>
              )}
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-6">
            <div className="st-container">
              <h5>Combobox Items</h5>
              <ul className="list-group">
                {items.map((item: ComboboxItem) => (
                  <li className="list-group-item" key={item.label}>
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="col-6">
            <div className="st-container">
              <h5>Combobox</h5>
              <Combobox
                options={items}
                selectedItem={selectedItem}
                onSelectValue={item => {
                  comboboxStore.setSelectedItem(item);
                }}
                onInputChange={(val: string) => {
                  comboboxStore.setQuery(val);
                }}
                onInputEnter={() => {
                  /* as the ReactCreatable doesn't pass
                   * an input value on set-value we can use our store-query
                   */
                  if (query.length) {
                    comboboxStore.addNewItem(query);
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default observer(Home);
