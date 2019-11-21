import { useState, useEffect } from "react";
import _throttle from "lodash/throttle";

// use this hook to track the mouse positon
export default function useMousePosition() {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  /* on hook init we need to add mousemove evt listener
   * and do it only once hence we are using the second argument - []
   */
  useEffect(() => {
    // avoid unnecessary browser highload during mouse moving
    const evtHandler = (e: MouseEvent) =>
      setPosition({ x: e.clientX, y: e.clientY });
    const throttledEvtHandler = _throttle(evtHandler, 17);
    window.addEventListener("mousemove", throttledEvtHandler);

    // need to remove a listener on component unmount to avoid memory leak
    return () => {
      window.removeEventListener("mousemove", throttledEvtHandler);
    };
  }, []);

  return position;
}
