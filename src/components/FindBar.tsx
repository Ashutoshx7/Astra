import React from 'react';
import type { FindResult } from '../types/renderer';

interface FindBarProps {
  findText: string;
  findResult: FindResult | null;
  onTextChange: (text: string) => void;
  onClose: () => void;
  findInputRef: React.RefObject<HTMLInputElement | null>;
}

const FindBar: React.FC<FindBarProps> = ({
  findText, findResult, onTextChange, onClose, findInputRef,
}) => (
  <div className="find-bar">
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (findText) window.astra.findInPage(findText);
      }}
      className="find-form"
    >
      <input
        ref={findInputRef}
        className="find-input"
        type="text"
        value={findText}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Find in page..."
        spellCheck={false}
      />
      {findResult && (
        <span className="find-count">
          {findResult.activeMatchOrdinal}/{findResult.matches}
        </span>
      )}
      <button type="button" className="find-close" onClick={onClose}>
        ✕
      </button>
    </form>
  </div>
);

export default FindBar;
