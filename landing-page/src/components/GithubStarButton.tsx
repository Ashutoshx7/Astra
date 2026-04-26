"use client";

import React, { useRef } from "react";
import gsap from "gsap";

export default function GithubStarButton() {
  const buttonRef = useRef<HTMLAnchorElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Do not prevent default so it still opens the GitHub link in new tab.
    // e.preventDefault(); 
    
    const button = buttonRef.current;
    if (!button || button.classList.contains('animated')) {
      return;
    }

    button.classList.add('animated');

    gsap.to(button, {
      keyframes: [{
        '--star-y': '-36px',
        duration: .3,
        ease: 'power2.out'
      }, {
        '--star-y': '48px',
        '--star-scale': .4,
        duration: .325,
        onStart() {
          button.classList.add('star-round');
        }
      }, {
        '--star-y': '-64px',
        '--star-scale': 1,
        duration: .45,
        ease: 'power2.out',
        onStart() {
          button.classList.toggle('active');
          setTimeout(() => button.classList.remove('star-round'), 100);
        }
      }, {
        '--star-y': '0px',
        duration: .45,
        ease: 'power2.in'
      }, {
        '--button-y': '3px',
        duration: .11
      }, {
        '--button-y': '0px',
        '--star-face-scale': .65,
        duration: .125
      }, {
        '--star-face-scale': 1,
        duration: .15
      }],
      clearProps: true,
      onComplete() {
        button.classList.remove('animated');
      }
    });

    gsap.to(button, {
      keyframes: [{
        '--star-hole-scale': .8,
        duration: .5,
        ease: 'elastic.out(1, .75)'
      }, {
        '--star-hole-scale': 0,
        duration: .2,
        delay: .2
      }]
    });

    gsap.to(button, {
      '--star-rotate': '360deg',
      duration: 1.55,
      clearProps: true
    });
  };

  return (
    <a 
      href="https://github.com/Ashutoshx7/Astra" 
      target="_blank" 
      rel="noopener noreferrer"
      className="favorite-button !h-10 !min-w-[140px]"
      ref={buttonRef}
      onClick={handleClick}
    >
      <div className="icon z-10">
        <div className="star"></div>
      </div>
      <span className="z-10 ml-1">Star on GitHub</span>
    </a>
  );
}
