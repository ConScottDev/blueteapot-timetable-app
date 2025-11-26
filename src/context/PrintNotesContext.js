import React, { createContext, useCallback, useMemo, useState } from "react";
import PropTypes from "prop-types";

const noop = () => {};

export const PrintNotesContext = createContext({
  notes: {},
  updateNote: noop,
  resetNotes: noop,
});

export const PrintNotesProvider = ({ children }) => {
  const [notes, setNotes] = useState({});

  const updateNote = useCallback((cellId, value) => {
    setNotes((prev) => {
      if (!cellId) return prev;
      if (!value) {
        const { [cellId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [cellId]: value };
    });
  }, []);

  const resetNotes = useCallback(() => setNotes({}), []);

  const contextValue = useMemo(
    () => ({
      notes,
      updateNote,
      resetNotes,
    }),
    [notes, updateNote, resetNotes]
  );

  return <PrintNotesContext.Provider value={contextValue}>{children}</PrintNotesContext.Provider>;
};

PrintNotesProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default PrintNotesContext;
