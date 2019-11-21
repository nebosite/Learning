import * as React from "react";

export default function TextInpTrackedLn() {
  const [val, setVal] = React.useState("");

  return (
    <div className="text-input-tracked">
      <input
        type="text"
        value={val}
        onChange={e => {
          setVal(e.target.value);
        }}
      />
      <br />
      <br />
      The text length is: <b className="attention-msg">{val.length}</b>
    </div>
  );
}
