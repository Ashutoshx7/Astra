"use client";

import React, { useEffect, useRef } from "react";
import "./Keyboard.scss";

// A single 3D key component
const Key = ({ size = "", colors = [] }: { size?: string; colors?: string[] }) => {
  const c1 = colors[0] || "";
  const c2 = colors[1] || "";
  const c3 = colors[2] || "";
  
  return (
    <div className={`key flex ${size ? `key--${size}` : ""}`}>
      <div className={`key__front face ${size ? `key__front--${size}` : ""} ${c3}`}></div>
      <div className={`key__back face ${size ? `key__back--${size}` : ""} ${c1}`}></div>
      <div className={`key__right face ${size ? `key__right--${size}` : ""} ${c1}`}></div>
      <div className={`key__left face ${size ? `key__left--${size}` : ""} ${c2}`}></div>
      <div className={`key__top face ${size ? `key__top--${size}` : ""} ${c1}`}></div>
      <div className={`key__bottom face ${size ? `key__bottom--${size}` : ""} ${c2}`}></div>
    </div>
  );
};

export default function Keyboard() {
  const mRef = useRef<HTMLDivElement>(null);
  const kRef = useRef<HTMLDivElement>(null);
  const sRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const m = mRef.current;
    const k = kRef.current;
    const s = sRef.current;
    if (!m || !k || !s) return;

    const kd = document.querySelectorAll(".key");
    let con = 0;

    // Fixed isometric perspective, no mouse tracking
    k.style.transform = `
        perspective(10000px)
        rotateX(60deg)
        rotateZ(-35deg)
    `;

    const addKey = (e: any) => {
      const kc = e.keyCode || e;
      const char = e.char;
      const isAuto = e.isAuto;

      if ((kc >= 65 && kc <= 90) || kc === 32) {
        if (kc === 81) { kd[15]?.classList.add("key--down"); }
        else if (kc === 87) { kd[16]?.classList.add("key--down"); }
        else if (kc === 69) { kd[17]?.classList.add("key--down"); }
        else if (kc === 82) { kd[18]?.classList.add("key--down"); }
        else if (kc === 84) { kd[19]?.classList.add("key--down"); }
        else if (kc === 89) { kd[20]?.classList.add("key--down"); }
        else if (kc === 85) { kd[21]?.classList.add("key--down"); }
        else if (kc === 73) { kd[22]?.classList.add("key--down"); }
        else if (kc === 79) { kd[23]?.classList.add("key--down"); }
        else if (kc === 80) { kd[24]?.classList.add("key--down"); }
        else if (kc === 65) { kd[29]?.classList.add("key--down"); }
        else if (kc === 83) { kd[30]?.classList.add("key--down"); }
        else if (kc === 68) { kd[31]?.classList.add("key--down"); }
        else if (kc === 70) { kd[32]?.classList.add("key--down"); }
        else if (kc === 71) { kd[33]?.classList.add("key--down"); }
        else if (kc === 72) { kd[34]?.classList.add("key--down"); }
        else if (kc === 74) { kd[35]?.classList.add("key--down"); }
        else if (kc === 75) { kd[36]?.classList.add("key--down"); }
        else if (kc === 76) { kd[37]?.classList.add("key--down"); }
        else if (kc === 192) { kd[38]?.classList.add("key--down"); }
        else if (kc === 90) { kd[41]?.classList.add("key--down"); }
        else if (kc === 88) { kd[42]?.classList.add("key--down"); }
        else if (kc === 67) { kd[43]?.classList.add("key--down"); }
        else if (kc === 86) { kd[44]?.classList.add("key--down"); }
        else if (kc === 66) { kd[45]?.classList.add("key--down"); }
        else if (kc === 78) { kd[46]?.classList.add("key--down"); }
        else if (kc === 77) { kd[47]?.classList.add("key--down"); }
        else if (kc === 13) { kd[39]?.classList.add("key--down"); }
        else if (kc === 32) { kd[56]?.classList.add("key--down"); }
      }

      if (isAuto && char) {
        if (char === ' ') s.innerHTML += ' ';
        else s.innerHTML += char;
      } else if (!isAuto && kc !== 8) {
        if (kc === 32) s.innerHTML += " ";
        else s.innerHTML += String.fromCharCode(kc);
      }

      if (kc === 8) {
          s.innerHTML = "";
          kd[27]?.classList.add("key--down");
      }
    };

    const removeKey = (e: any) => {
      const kc = e.keyCode || e;
      if (kc === 81) { kd[15]?.classList.remove("key--down"); }
      else if (kc === 87) { kd[16]?.classList.remove("key--down"); }
      else if (kc === 69) { kd[17]?.classList.remove("key--down"); }
      else if (kc === 82) { kd[18]?.classList.remove("key--down"); }
      else if (kc === 84) { kd[19]?.classList.remove("key--down"); }
      else if (kc === 89) { kd[20]?.classList.remove("key--down"); }
      else if (kc === 85) { kd[21]?.classList.remove("key--down"); }
      else if (kc === 73) { kd[22]?.classList.remove("key--down"); }
      else if (kc === 79) { kd[23]?.classList.remove("key--down"); }
      else if (kc === 80) { kd[24]?.classList.remove("key--down"); }
      else if (kc === 65) { kd[29]?.classList.remove("key--down"); }
      else if (kc === 83) { kd[30]?.classList.remove("key--down"); }
      else if (kc === 68) { kd[31]?.classList.remove("key--down"); }
      else if (kc === 70) { kd[32]?.classList.remove("key--down"); }
      else if (kc === 71) { kd[33]?.classList.remove("key--down"); }
      else if (kc === 72) { kd[34]?.classList.remove("key--down"); }
      else if (kc === 74) { kd[35]?.classList.remove("key--down"); }
      else if (kc === 75) { kd[36]?.classList.remove("key--down"); }
      else if (kc === 76) { kd[37]?.classList.remove("key--down"); }
      else if (kc === 192) { kd[38]?.classList.remove("key--down"); }
      else if (kc === 90) { kd[41]?.classList.remove("key--down"); }
      else if (kc === 88) { kd[42]?.classList.remove("key--down"); }
      else if (kc === 67) { kd[43]?.classList.remove("key--down"); }
      else if (kc === 86) { kd[44]?.classList.remove("key--down"); }
      else if (kc === 66) { kd[45]?.classList.remove("key--down"); }
      else if (kc === 78) { kd[46]?.classList.remove("key--down"); }
      else if (kc === 77) { kd[47]?.classList.remove("key--down"); }
      else if (kc === 32) { kd[56]?.classList.remove("key--down"); }
      else if (kc === 13) { kd[39]?.classList.remove("key--down"); }
      else if (kc === 8) { kd[27]?.classList.remove("key--down"); }
    };

    // Auto-typer script
    let typeIndex = 0;
    const textToType = "Astra. Fast, private, and beautiful web browser. Built with love by one stubborn developer.       ";
    let isTyping = true;
    let typeTimeout: any;

    const typeNextChar = () => {
      if (!isTyping || !s) return;
      const char = textToType[typeIndex];
      let kc = char.toUpperCase().charCodeAt(0);
      if (char === ' ') kc = 32;

      addKey({ keyCode: kc, isAuto: true, char });

      setTimeout(() => {
        removeKey({ keyCode: kc });
        typeIndex = (typeIndex + 1) % textToType.length;
        
        if (typeIndex === 0) {
          setTimeout(() => {
            s.innerHTML = "";
            typeTimeout = setTimeout(typeNextChar, 1000);
          }, 2000);
        } else {
          typeTimeout = setTimeout(typeNextChar, Math.random() * 80 + 40);
        }
      }, 80);
    };

    typeTimeout = setTimeout(typeNextChar, 1500);

    return () => {
      isTyping = false;
      clearTimeout(typeTimeout);
    };
  }, []);

  const bColors = ["face--key-b1", "face--key-b2", "face--key-b3"];
  const oColors = ["face--key-o1", "face--key-o2", "face--key-o3"];

  return (
    <div className="keyboard-container fixed bottom-4 left-4 pointer-events-none z-50 !w-auto !h-auto">
      <div className="main flex pointer-events-auto" id="m" ref={mRef}>
        <div className="keyboard flex" id="k" ref={kRef}>
          <div className="screen flex" id="s" ref={sRef}></div>
          <div className="keyboard__front face"></div>
          <div className="keyboard__back face"></div>
          <div className="keyboard__right face"></div>
          <div className="keyboard__left face"></div>
          <div className="keyboard__top face">
            
            {/* Row 1 */}
            <div className="keys">
              <Key colors={bColors} />
              {Array.from({ length: 12 }).map((_, i) => (
                <Key key={`r1-${i}`} />
              ))}
              <Key size="w2" colors={bColors} />
            </div>

            {/* Row 2 */}
            <div className="keys">
              <Key size="w2" colors={bColors} />
              {Array.from({ length: 12 }).map((_, i) => (
                <Key key={`r2-${i}`} />
              ))}
              <Key colors={bColors} />
            </div>

            {/* Row 3 */}
            <div className="keys">
              <Key size="w3" colors={bColors} />
              {Array.from({ length: 10 }).map((_, i) => (
                <Key key={`r3-${i}`} />
              ))}
              <Key size="w2" colors={oColors} />
            </div>

            {/* Row 4 */}
            <div className="keys">
              <Key size="w2" colors={bColors} />
              {Array.from({ length: 11 }).map((_, i) => (
                <Key key={`r4-${i}`} />
              ))}
              <Key size="w3" colors={bColors} />
            </div>

            {/* Row 5 */}
            <div className="keys">
              <Key colors={bColors} />
              <Key colors={oColors} />
              {Array.from({ length: 2 }).map((_, i) => (
                <Key key={`r5-1-${i}`} colors={bColors} />
              ))}
              <Key size="w6" />
              {Array.from({ length: 5 }).map((_, i) => (
                <Key key={`r5-2-${i}`} colors={bColors} />
              ))}
            </div>

          </div>
          <div className="keyboard__bottom face"></div>
        </div>
      </div>
    </div>
  );
}
